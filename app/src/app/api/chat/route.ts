import { NextRequest, NextResponse } from "next/server";
import { generateText, tool, stepCountIs, zodSchema } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { z } from "zod";
import { readConfig, writeConfig } from "@/lib/config";
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

function getModel() {
  const config = readConfig();
  const base = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = config.ollamaModel || "llama3.2";
  return createOllama({ baseURL: base })(model);
}

const SETUP_SYSTEM_PROMPT = `You are the MCP Operator setup assistant. Your job is to onboard the user in two phases.

PHASE 1 — CONNECT PLATFORMS:
Start by asking: "What do you want to automate? Describe it naturally."
From their answer, identify which platforms are needed (Discord, GitHub, Google Sheets, Slack, HubSpot, Stripe, Airtable, Notion, SendGrid).
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

function buildSystemPrompt(config: ReturnType<typeof readConfig>, knowledgeContext: string): string {
  if (config.setupComplete) {
    const integrations = config.enabledIntegrations.join(", ") || "none yet";
    const mission = config.agentMission || "Monitor connected platforms and report on activity.";

    // Tell the model exactly which credentials are set vs missing
    const credStatus = [
      `GitHub token: ${config.githubToken ? "✓ set" : "✗ missing"}`,
      `GitHub repo: ${config.githubRepo ? `✓ set (${config.githubRepo})` : "✗ missing"}`,
      `Discord webhook: ${config.discordWebhookUrl ? "✓ set" : "✗ missing"}`,
      `Slack webhook: ${config.slackWebhookUrl ? "✓ set" : "✗ missing"}`,
      `Airtable API key: ${config.airtableApiKey ? "✓ set" : "✗ missing"}`,
      `Airtable base ID: ${config.airtableBaseId ? "✓ set" : "✗ missing"}`,
    ].join("\n");

    return `You are MCP Operator, an AI assistant managing the user's automations.

Current mission: ${mission}
Connected integrations: ${integrations}

Credential status:
${credStatus}

You can help the user:
- Understand what their agent is doing and why
- Add or update API keys (call save_config)
- Create new scheduled jobs (call create_job)
- Change the agent mission or schedule
- Troubleshoot failed jobs or connections
- Explain what each integration does

IMPORTANT: Before calling create_job, check the credential status above. If any credentials required by the job are missing (✗), tell the user exactly which ones are missing and ask them to add them in Settings first. Only call create_job once all required credentials are set.

Keep responses short and actionable. If asked to save a credential, use save_config then test_connection.
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

  const config = readConfig();

  let result;
  try {
    result = await generateText({
      model: getModel(),
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

          writeConfig({ [configKey]: value } as Record<string, string>);

          if (service !== "ai") {
            const config = readConfig();
            const integrations = new Set(config.enabledIntegrations);
            integrations.add(service.toLowerCase());
            writeConfig({ enabledIntegrations: Array.from(integrations) });
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
          const config = readConfig();
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
          writeConfig({ agentMission: mission });
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
          writeConfig({ cronIntervalMinutes: clamped });
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
          const job = createJob({ name, mission, integrations, intervalMinutes, autoRun });
          return { ok: true, message: `Job "${job.name}" created (id: ${job.id})` };
        },
      }),

      complete_setup: tool<Record<string, never>, ToolOutput>({
        description: "Mark setup as complete and send the user to the dashboard",
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          writeConfig({ setupComplete: true });
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
