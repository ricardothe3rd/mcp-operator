import { NextRequest, NextResponse } from "next/server";
import { generateText, tool, stepCountIs, zodSchema, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { readConfig, writeConfig } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

// Explicit allowlist for save_config tool — no arbitrary key injection
const ALLOWED_CONFIG_KEYS = new Set([
  "discordWebhookUrl", "githubToken", "githubRepo", "slackWebhookUrl",
  "googleSheetsApiKey", "googleSpreadsheetId", "hubspotApiKey", "stripeApiKey",
  "airtableApiKey", "airtableBaseId", "notionApiKey", "sendgridApiKey",
  "aiProvider", "aiApiKey", "aiModel",
]);

/** Auto-detect which API key is available and return a working model */
function getSetupModel(): LanguageModel {
  // Check config file first (key saved via Settings page)
  const config = readConfig();
  if (config.aiProvider && config.aiApiKey) {
    switch (config.aiProvider) {
      case "google": {
        const g = createGoogleGenerativeAI({ apiKey: config.aiApiKey });
        return g("gemini-2.0-flash");
      }
      case "anthropic": {
        const a = createAnthropic({ apiKey: config.aiApiKey });
        return a("claude-haiku-4-5-20251001");
      }
      case "openai": {
        const o = createOpenAI({ apiKey: config.aiApiKey });
        return o("gpt-4o-mini");
      }
    }
  }

  // Fallback to environment variables
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleKey) {
    const g = createGoogleGenerativeAI({ apiKey: googleKey });
    return g("gemini-2.0-flash");
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const a = createAnthropic({ apiKey: anthropicKey });
    return a("claude-haiku-4-5-20251001");
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const o = createOpenAI({ apiKey: openaiKey });
    return o("gpt-4o-mini");
  }
  throw new Error(
    "No AI API key found. Add your Google API key in Settings or set GOOGLE_API_KEY in .env.local"
  );
}

const SETUP_SYSTEM_PROMPT = `You are the MCP Operator setup assistant. Your job is to onboard the user in two phases.

PHASE 1 — CONNECT PLATFORMS:
Start by asking: "What do you want to automate? Describe it naturally."
From their answer, identify which platforms are needed (Discord, GitHub, Google Sheets, Slack, HubSpot, Stripe, Airtable, Notion, SendGrid).
For each needed platform: ask for the credential ONE at a time → call save_config → call test_connection → confirm result → move to next.
Also ask for their AI model provider (Google Gemini / OpenAI / Anthropic) and API key. Test it.
Do NOT move to Phase 2 until all platforms are connected and tested.

PHASE 2 — DEFINE BEHAVIOR:
Once all connections are verified, confirm the mission based on what they described at the start.
Ask how often to run automatically (default suggestion: every 10 minutes) → call set_cron_interval.
Call set_agent_mission with a clear mission statement derived from their description.
Summarize what was configured in a short bullet list, then call complete_setup.

Rules:
- Be brief and conversational. One question at a time.
- Never ask for multiple credentials at once.
- After save_config + test_connection, always confirm the result before moving on.
- If a test fails, tell the user what went wrong and ask them to try again.
- Never echo raw credentials back to the user.`;

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
  ai: { apiKey: "aiApiKey", provider: "aiProvider", model: "aiModel" },
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

  const result = await generateText({
    model: getSetupModel(),
    system: SETUP_SYSTEM_PROMPT,
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

              case "ai": {
                if (!config.aiApiKey)
                  return { ok: false, message: "No API key saved" };
                const names: Record<string, string> = {
                  google: "Google Gemini",
                  anthropic: "Anthropic Claude",
                  openai: "OpenAI",
                };
                const name = names[config.aiProvider] || config.aiProvider;
                return { ok: true, message: `${name} API key saved` };
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
}
