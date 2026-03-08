import { NextRequest, NextResponse } from "next/server";
import { generateText, tool, stepCountIs, zodSchema } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { loadConfig, writeConfig, type MCPConfig } from "@/lib/config";
import { createJob } from "@/lib/jobs";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";
import { buildKnowledgeContext } from "@/lib/knowledge";

// Explicit allowlist for save_config tool — no arbitrary key injection
// Note: aiProvider/aiApiKey/aiModel intentionally excluded — chat cannot change the LLM
const ALLOWED_CONFIG_KEYS = new Set([
  "discordWebhookUrl", "githubToken", "githubRepo", "slackWebhookUrl",
  "googleSheetsApiKey", "googleSpreadsheetId", "hubspotApiKey", "stripeApiKey",
  "airtableApiKey", "airtableBaseId", "notionApiKey", "sendgridApiKey", "resendApiKey",
]);

function getModel(config: MCPConfig) {
  switch (config.aiProvider) {
    case "groq":
      return createGroq({ apiKey: config.aiApiKey })("llama-3.3-70b-versatile");
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.aiApiKey })("gemini-2.0-flash");
    case "openai":
      return createOpenAI({ apiKey: config.aiApiKey })("gpt-4o-mini");
    case "anthropic":
      return createAnthropic({ apiKey: config.aiApiKey || process.env.ANTHROPIC_API_KEY || "" })("claude-haiku-4-5-20251001");
    default: {
      const base = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createOllama({ baseURL: base })(config.ollamaModel || "llama3.2") as any;
    }
  }
}

const SETUP_SYSTEM_PROMPT = `You are the MCP Operator setup assistant. Your job is to onboard the user in two phases.

PHASE 1 — CONNECT PLATFORMS:
Start by asking: "What do you want to automate? Describe it naturally."
From their answer, identify which platforms are needed (Discord, GitHub, Google Sheets, Slack, HubSpot, Stripe, Airtable, Notion, SendGrid, Resend).
For each needed platform: ask for the credential ONE at a time → call save_config → call test_connection → confirm result → move to next.
Do NOT move to Phase 2 until all platforms are connected and tested.

PHASE 2 — DEFINE BEHAVIOR:
Once all connections are verified, confirm the mission based on what they described at the start.
Ask how often to run automatically (default suggestion: every 24 hours) → call create_job with the mission, integrations, and interval.
Summarize what was configured in a short bullet list, then call complete_setup.

Rules:
- Be brief and conversational. One question at a time.
- Never ask for multiple credentials at once.
- After save_config + test_connection, always confirm the result before moving on.
- If a test fails, tell the user what went wrong and ask them to try again.
- Never echo raw credentials back to the user.`;

function buildSystemPrompt(config: MCPConfig, knowledgeContext: string): string {
  if (config.setupComplete) {
    const integrations = config.enabledIntegrations.join(", ") || "none yet";
    const mission = config.agentMission || "Monitor connected platforms and report on activity.";

    // Tell the model exactly which credentials are set vs missing
    const credStatus = [
      `GitHub token: ${config.githubToken ? "✓ set" : "✗ missing"}`,
      `GitHub repo: ${config.githubRepo ? `✓ set (${config.githubRepo})` : "✗ missing"}`,
      `Discord webhook: ${config.discordWebhookUrl ? "✓ set" : "✗ missing"}`,
      `Airtable API key: ${config.airtableApiKey ? "✓ set" : "✗ missing"}`,
      `Airtable base ID: ${config.airtableBaseId ? "✓ set" : "✗ missing"}`,
      `Resend API key: ${config.resendApiKey ? "✓ set" : "✗ missing"}`,
    ].join("\n");

    return `You are MCP Operator, an AI assistant managing the user's automations.

Current mission: ${mission}
Connected integrations: ${integrations}

Credential status:
${credStatus}

HOW TO HANDLE AUTOMATION REQUESTS:

Step 1 — DISCOVER: If the user wants to automate something but hasn't told you which apps or what action to take, ask ONE question: "What would you like to automate? Which apps do you want to connect?" Do not check credentials yet.

Step 2 — UNDERSTAND: Once they describe the specific automation, identify which services are needed.

Step 3 — CHECK CREDENTIALS (REQUIRED — do not skip): For each service needed by this automation, check the credential status above. If ANY required credential is ✗ missing, STOP and say: "You'll need to add your [service] credentials in Settings first." Do NOT call create_job until every needed credential shows ✓ set. Only check services relevant to this automation — ignore others.

Step 4 — CREATE: Only once ALL needed credentials show ✓ set, call create_job immediately. Do not ask for confirmation. You fill in all parameters yourself — never ask the user for JSON, arrays, or field names.

Parameters you infer for create_job:
- name: short label (3-5 words) from what they said
- mission: clear instruction for what the agent does each run
- integrations: array of service names, e.g. ["github", "slack"]
- intervalMinutes: infer from "daily"=1440, "hourly"=60, "every 30 min"=30. If unclear, ask ONE question: "How often should this run?"
- autoRun: always true unless they say otherwise

Example: user says "post github commits to discord every hour"
→ Check only github + discord in credential status
→ Both ✓ set → call create_job immediately with the right params

Keep responses short. Never show tool parameter names or JSON to the user.
Never echo raw credentials back to the user.
${knowledgeContext}`;
  }
  return SETUP_SYSTEM_PROMPT + knowledgeContext;
}

const SERVICE_FIELD_MAP: Record<string, Record<string, string>> = {
  discord: { webhookUrl: "discordWebhookUrl" },
  github: { token: "githubToken", repo: "githubRepo" },
  slack: { webhookUrl: "slackWebhookUrl" },
  google_sheets: {
    apiKey: "googleSheetsApiKey",
    spreadsheetId: "googleSpreadsheetId",
  },
  hubspot: { apiKey: "hubspotApiKey" },
  stripe: { apiKey: "stripeApiKey" },
  airtable: { apiKey: "airtableApiKey", baseId: "airtableBaseId" },
  notion: { apiKey: "notionApiKey" },
  sendgrid: { apiKey: "sendgridApiKey" },
};

type ToolOutput = { ok: boolean; message: string; redirect?: string };

export async function POST(req: NextRequest) {
  const session = await auth();

  // Rate limit: 30 chat messages per minute per user
  const key = `chat:${session?.user?.email ?? "anon"}`;
  const { ok, retryAfter } = checkRateLimit(key, 30, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { messages } = await req.json();

  // Pull the last user message to search the knowledge base
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const knowledgeContext = lastUserMessage
    ? buildKnowledgeContext(lastUserMessage.content ?? "")
    : "";

  const config = await loadConfig();

  let result;
  try {
    result = await generateText({
      model: getModel(config),
      system: buildSystemPrompt(config, knowledgeContext),
      messages,
      stopWhen: stepCountIs(10),
      tools: {
        save_config: tool<
        { service: string; field: string; value: string },
        ToolOutput
      >({
        description: "Save a configuration value for a service",
        inputSchema: zodSchema(
          z.object({
            service: z
              .string()
              .describe(
                "Service: discord, github, slack, google_sheets, hubspot, stripe, airtable, notion, sendgrid, ai"
              ),
            field: z
              .string()
              .describe(
                "Field: webhookUrl, token, repo, apiKey, spreadsheetId, baseId, provider, model"
              ),
            value: z.string().describe("The credential or config value"),
          })
        ),
        execute: async ({ service, field, value }) => {
          const serviceFields = SERVICE_FIELD_MAP[service.toLowerCase()];
          const configKey = serviceFields?.[field] ?? field;

          // Block any key not in the explicit allowlist
          if (!ALLOWED_CONFIG_KEYS.has(configKey)) {
            return { ok: false, message: `Unknown config key: ${configKey}` };
          }

          await writeConfig({ [configKey]: value } as Record<string, string>);

          if (service !== "ai") {
            const config = await loadConfig();
            const integrations = new Set(config.enabledIntegrations);
            integrations.add(service.toLowerCase());
            await writeConfig({ enabledIntegrations: Array.from(integrations) });
          }

          return { ok: true, message: `Saved ${service} ${field}` };
        },
      }),

      test_connection: tool<{ service: string }, ToolOutput>({
        description: "Test a service connection to verify credentials work",
        inputSchema: zodSchema(
          z.object({
            service: z
              .string()
              .describe("Service to test: discord, github, slack, ai"),
          })
        ),
        execute: async ({ service }) => {
          const config = await loadConfig();
          try {
            switch (service.toLowerCase()) {
              case "discord": {
                if (!config.discordWebhookUrl)
                  return { ok: false, message: "No webhook URL saved" };
                const res = await fetch(config.discordWebhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: "✅ MCP Operator connected successfully!",
                  }),
                });
                if (!res.ok)
                  return {
                    ok: false,
                    message: `Discord returned ${res.status}`,
                  };
                return {
                  ok: true,
                  message: "Discord connected — test message sent",
                };
              }

              case "github": {
                if (!config.githubToken)
                  return { ok: false, message: "No token saved" };
                const res = await fetch("https://api.github.com/user", {
                  headers: {
                    Authorization: `Bearer ${config.githubToken}`,
                    "User-Agent": "mcp-operator",
                  },
                });
                if (!res.ok)
                  return {
                    ok: false,
                    message: `GitHub returned ${res.status}`,
                  };
                const data = await res.json();
                return {
                  ok: true,
                  message: `GitHub connected as ${data.login}`,
                };
              }

              case "slack": {
                if (!config.slackWebhookUrl)
                  return { ok: false, message: "No webhook URL saved" };
                const res = await fetch(config.slackWebhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: "✅ MCP Operator connected successfully!",
                  }),
                });
                if (!res.ok)
                  return {
                    ok: false,
                    message: `Slack returned ${res.status}`,
                  };
                return {
                  ok: true,
                  message: "Slack connected — test message sent",
                };
              }

              default:
                return { ok: true, message: `${service} configuration saved` };
            }
          } catch (err) {
            return {
              ok: false,
              message: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        },
      }),

      set_agent_mission: tool<{ mission: string }, ToolOutput>({
        description:
          "Save the user's mission — becomes the agent's runtime system prompt",
        inputSchema: zodSchema(
          z.object({
            mission: z
              .string()
              .describe("Mission statement derived from user's description"),
          })
        ),
        execute: async ({ mission }) => {
          await writeConfig({ agentMission: mission });
          return { ok: true, message: "Mission saved" };
        },
      }),

      set_cron_interval: tool<{ minutes: number }, ToolOutput>({
        description: "Set how often the agent runs automatically, in minutes",
        inputSchema: zodSchema(
          z.object({
            minutes: z.number().describe("Interval in minutes, e.g. 5, 10, 30"),
          })
        ),
        execute: async ({ minutes }) => {
          const clamped = Math.max(1, Math.min(1440, Math.round(minutes)));
          await writeConfig({ cronIntervalMinutes: clamped });
          return { ok: true, message: `Cron set to every ${clamped} minutes` };
        },
      }),

      create_job: tool<
        { name: string; mission: string; integrations: string[]; intervalMinutes: number; autoRun: boolean },
        ToolOutput
      >({
        description: "Create a new scheduled agent job",
        inputSchema: zodSchema(
          z.object({
            name: z.string().describe("Short name for the job, e.g. 'Daily GitHub Briefing'"),
            mission: z.string().describe("Full mission statement the agent will execute each run"),
            integrations: z.array(z.string()).describe("Services needed, e.g. ['github', 'discord']"),
            intervalMinutes: z.number().describe("How often to run in minutes, e.g. 1440 for 24h"),
            autoRun: z.boolean().describe("Whether to start running automatically"),
          })
        ),
        execute: async ({ name, mission, integrations, intervalMinutes, autoRun }) => {
          const job = await createJob({ name, mission, integrations, intervalMinutes, autoRun });
          return { ok: true, message: `Job "${job.name}" created (id: ${job.id})` };
        },
      }),

      complete_setup: tool<Record<string, never>, ToolOutput>({
        description: "Mark setup as complete and send the user to the dashboard",
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          await writeConfig({ setupComplete: true });
          return {
            ok: true,
            redirect: "/dashboard",
            message: "Setup complete — your agent is live",
          };
        },
      }),
    },
  });

  // Collect all tool results from every step
  const toolResults = result.steps.flatMap(
    (step) =>
      step.toolResults?.map((tr) => {
        const out = tr.output as ToolOutput;
        return {
          tool: tr.toolName,
          ok: out.ok,
          message: out.message,
          redirect: out.redirect,
        };
      }) ?? []
  );

  const redirectTo = toolResults.find((t) => t.redirect)?.redirect ?? null;

  return NextResponse.json({ reply: result.text, toolResults, redirectTo });
  } catch (err) {
    console.error("[chat] generateText error:", err);
    return NextResponse.json({
      reply: `Ollama error: ${err instanceof Error ? err.message : "unknown error"}. Is Ollama running at ${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}?`,
      toolResults: [],
      redirectTo: null,
    });
  }
}
