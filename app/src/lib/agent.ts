import { generateText, tool, stepCountIs, zodSchema, type Tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createOllama } from "ai-sdk-ollama";
import { z } from "zod";
import { loadConfig, MCPConfig } from "./config";
import { appendActivity } from "./activity";
import { buildKnowledgeContext } from "./knowledge";
import { loadMCPTools } from "./mcp-loader";

export interface AgentResult {
  success: boolean;
  message: string;
  actions: string[];
}

const FALLBACK_MISSION =
  "Monitor connected platforms and report on any notable activity.";

function getModel(config: MCPConfig) {
  switch (config.aiProvider) {
    case "ollama": {
      const base = config.ollamaBaseUrl || "http://localhost:11434";
      const ollama = createOllama({ baseURL: base });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ollama(config.ollamaModel || "llama3.2") as any;
    }
    case "groq": {
      const groq = createGroq({ apiKey: config.aiApiKey });
      return groq("llama-3.3-70b-versatile");
    }
    case "google": {
      const g = createGoogleGenerativeAI({ apiKey: config.aiApiKey });
      return g("gemini-2.0-flash");
    }
    case "openai": {
      const o = createOpenAI({ apiKey: config.aiApiKey });
      return o("gpt-4o-mini");
    }
    case "anthropic": {
      const key = config.aiApiKey || process.env.ANTHROPIC_API_KEY || "";
      const a = createAnthropic({ apiKey: key });
      return a("claude-haiku-4-5-20251001");
    }
    default: {
      // Prefer Anthropic via env var (works on Vercel); fall back to Ollama locally
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        return createAnthropic({ apiKey: anthropicKey })("claude-haiku-4-5-20251001");
      }
      const ollamaBase = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaModel = config.ollamaModel || "llama3.2";
      const ollama = createOllama({ baseURL: ollamaBase });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ollama(ollamaModel) as any;
    }
  }
}

export async function runAgent(
  trigger: string,
  context?: string,
  jobId?: string,
  jobMission?: string,
  jobIntegrations?: string[]
): Promise<AgentResult> {
  const config = await loadConfig();
  const mission = jobMission || config.agentMission || FALLBACK_MISSION;
  const actions: string[] = [];

  // Use job-specific integrations if provided, otherwise fall back to all enabled
  const activeIntegrations = jobIntegrations ?? config.enabledIntegrations;

  const configContext = [
    config.githubRepo ? `GitHub repo: ${config.githubRepo}` : "",
    config.airtableBaseId ? `Airtable base ID: ${config.airtableBaseId}` : "",
    config.airtableTableNames?.length ? `Airtable tables: ${config.airtableTableNames.join(", ")}` : "",
    config.resendApiKey ? `Resend is configured for sending email.` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are MCP Operator, an autonomous agent with REAL tools connected to REAL APIs.

Your mission: ${mission}

Connected integrations: ${activeIntegrations.join(", ") || "none"}
${configContext ? `\nConfiguration:\n${configContext}` : ""}

CRITICAL RULES — follow these exactly:
1. You have real tools. Call them immediately. Do NOT explain, ask, or hesitate.
2. NEVER say you "cannot" make API calls — you can, via the tools provided.
3. NEVER treat this as a simulation — this is a live system with real credentials.
4. If your mission involves GitHub + Discord: call get_recent_commits THEN post_to_discord.
5. After calling tools, write a brief 2-3 sentence summary of what you did.
6. If a tool call fails, say so briefly — do not write paragraphs explaining limitations.

Act now. Do not ask for permission.`;

  const userMessage = context
    ? `Trigger: ${trigger}\n\n${context}`
    : `Trigger: ${trigger}. Perform your mission.`;

  const knowledgeContext = buildKnowledgeContext(`${mission} ${trigger}`);

  // Load only the MCPs needed for this job's integrations
  const mcpConfig = { ...config, enabledIntegrations: activeIntegrations };
  const { tools: mcpTools, cleanup } = await loadMCPTools(mcpConfig);
  const hardcodedTools = buildHardcodedTools(config);
  // MCP tools win on collision
  const tools = { ...hardcodedTools, ...mcpTools };

  try {
    const result = await generateText({
      model: getModel(config),
      system: systemPrompt + knowledgeContext,
      prompt: userMessage,
      stopWhen: stepCountIs(8),
      tools,
    });

    // Collect actions from tool calls
    for (const step of result.steps) {
      for (const tc of step.toolCalls ?? []) {
        actions.push(`Called ${tc.toolName}`);
      }
    }
    actions.push(result.text || "Agent completed run");

    await appendActivity({ trigger, actions, success: true, message: result.text, jobId });

    return { success: true, message: result.text, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await appendActivity({ trigger, actions, success: false, message, jobId });
    return { success: false, message, actions };
  } finally {
    await cleanup();
  }
}

/** Hardcoded tools — always available as fallbacks when MCP stdio is unavailable (e.g. Vercel). */
function buildHardcodedTools(config: MCPConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, Tool<any, any>> = {};

  // Slack
  if (config.slackWebhookUrl) {
    tools.post_to_slack = tool<{ message: string }, { ok: boolean; message: string }>({
      description: "Post a message to Slack via the configured webhook",
      inputSchema: zodSchema(
        z.object({ message: z.string().describe("The message to post") })
      ),
      execute: async ({ message }) => {
        const res = await fetch(config.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        });
        return res.ok
          ? { ok: true, message: "Posted to Slack" }
          : { ok: false, message: `Slack error ${res.status}` };
      },
    });
  }

  // Discord (fallback — MCP server overrides when available)
  if (config.discordWebhookUrl) {
    tools.post_to_discord = tool<{ message: string }, { ok: boolean; message: string }>({
      description: "Post a message to Discord via the configured webhook",
      inputSchema: zodSchema(
        z.object({ message: z.string().describe("The message to post") })
      ),
      execute: async ({ message }) => {
        const res = await fetch(config.discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: message }),
        });
        return res.ok
          ? { ok: true, message: "Posted to Discord" }
          : { ok: false, message: `Discord error ${res.status}` };
      },
    });
  }

  // GitHub (fallback — MCP server overrides when available)
  if (config.githubToken) {
    const ghHeaders = {
      Authorization: `Bearer ${config.githubToken}`,
      "User-Agent": "mcp-operator",
      Accept: "application/vnd.github+json",
    };

    tools.list_pull_requests = tool<
      { state?: string },
      { ok: boolean; prs?: { number: number; title: string; user: string; created_at: string; html_url: string }[]; message: string }
    >({
      description: "List pull requests from the configured GitHub repo",
      inputSchema: zodSchema(
        z.object({
          state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state (default: open)"),
        })
      ),
      execute: async ({ state = "open" }) => {
        if (!config.githubRepo) return { ok: false, message: "No GitHub repo configured" };
        const res = await fetch(
          `https://api.github.com/repos/${config.githubRepo}/pulls?state=${state}&per_page=20`,
          { headers: ghHeaders }
        );
        if (!res.ok) return { ok: false, message: `GitHub error ${res.status}` };
        const data = await res.json();
        return {
          ok: true,
          prs: data.map((pr: { number: number; title: string; user: { login: string }; created_at: string; html_url: string }) => ({
            number: pr.number,
            title: pr.title,
            user: pr.user.login,
            created_at: pr.created_at,
            html_url: pr.html_url,
          })),
          message: `Fetched ${data.length} PRs`,
        };
      },
    });

    tools.get_recent_commits = tool<
      { per_page?: number },
      { ok: boolean; commits?: { sha: string; message: string; author: string; date: string }[]; message: string }
    >({
      description: "Get recent commits from the configured GitHub repo",
      inputSchema: zodSchema(
        z.object({
          per_page: z.number().optional().describe("Number of commits to return (default: 10)"),
        })
      ),
      execute: async ({ per_page = 10 }) => {
        if (!config.githubRepo) return { ok: false, message: "No GitHub repo configured" };
        const res = await fetch(
          `https://api.github.com/repos/${config.githubRepo}/commits?per_page=${per_page}`,
          { headers: ghHeaders }
        );
        if (!res.ok) return { ok: false, message: `GitHub error ${res.status}` };
        const data = await res.json();
        return {
          ok: true,
          commits: data.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } } }) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0],
            author: c.commit.author.name,
            date: c.commit.author.date,
          })),
          message: `Fetched ${data.length} commits`,
        };
      },
    });
  }

  // Airtable (fallback — MCP server overrides when available)
  if (config.airtableApiKey && config.airtableBaseId) {
    const atHeaders = {
      Authorization: `Bearer ${config.airtableApiKey}`,
      "Content-Type": "application/json",
    };

    tools.create_airtable_record = tool<
      { table: string; fields: Record<string, unknown> },
      { ok: boolean; id?: string; message: string }
    >({
      description: "Create a new record in an Airtable table",
      inputSchema: zodSchema(
        z.object({
          table: z.string().describe("Table name or ID"),
          fields: z.record(z.string(), z.unknown()).describe("Field values for the new record"),
        })
      ),
      execute: async ({ table, fields }) => {
        const res = await fetch(
          `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(table)}`,
          { method: "POST", headers: atHeaders, body: JSON.stringify({ fields }) }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, message: (err as { error?: { message?: string } })?.error?.message ?? `Airtable error ${res.status}` };
        }
        const data = await res.json() as { id: string };
        return { ok: true, id: data.id, message: `Record created: ${data.id}` };
      },
    });

    tools.list_airtable_records = tool<
      { table: string; max_records?: number },
      { ok: boolean; records?: { id: string; fields: Record<string, unknown> }[]; message: string }
    >({
      description: "List records from an Airtable table",
      inputSchema: zodSchema(
        z.object({
          table: z.string().describe("Table name or ID"),
          max_records: z.number().optional().describe("Max records to return (default: 20)"),
        })
      ),
      execute: async ({ table, max_records = 20 }) => {
        const res = await fetch(
          `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(table)}?maxRecords=${max_records}`,
          { headers: atHeaders }
        );
        if (!res.ok) return { ok: false, message: `Airtable error ${res.status}` };
        const data = await res.json() as { records: { id: string; fields: Record<string, unknown> }[] };
        return {
          ok: true,
          records: data.records.map((r) => ({ id: r.id, fields: r.fields })),
          message: `Fetched ${data.records.length} records`,
        };
      },
    });
  }

  // Resend (fallback — MCP server overrides when available)
  if (config.resendApiKey) {
    tools.send_email = tool<
      { to: string; subject: string; body: string; from?: string },
      { ok: boolean; id?: string; message: string }
    >({
      description: "Send an email via Resend",
      inputSchema: zodSchema(
        z.object({
          to: z.string().describe("Recipient email address"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body (plain text or HTML)"),
          from: z.string().optional().describe("Sender address (default: onboarding@resend.dev)"),
        })
      ),
      execute: async ({ to, subject, body, from = "onboarding@resend.dev" }) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to, subject, html: body }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, message: (err as { message?: string })?.message ?? `Resend error ${res.status}` };
        }
        const data = await res.json() as { id: string };
        return { ok: true, id: data.id, message: `Email sent (id: ${data.id})` };
      },
    });
  }

  return tools;
}
