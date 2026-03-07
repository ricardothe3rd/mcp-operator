import { generateText, tool, stepCountIs, zodSchema, type Tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { readConfig, MCPConfig } from "./config";
import { appendActivity } from "./activity";

export interface AgentResult {
  success: boolean;
  message: string;
  actions: string[];
}

const FALLBACK_MISSION =
  "Monitor connected platforms and report on any notable activity.";

function getModel(config: MCPConfig) {
  switch (config.aiProvider) {
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
      // Auto-detect from env
      const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (googleKey) {
        const g = createGoogleGenerativeAI({ apiKey: googleKey });
        return g("gemini-2.0-flash");
      }
      const a = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
      return a("claude-haiku-4-5-20251001");
    }
  }
}

export async function runAgent(
  trigger: string,
  context?: string,
  jobId?: string
): Promise<AgentResult> {
  const config = readConfig();
  const mission = config.agentMission || FALLBACK_MISSION;
  const actions: string[] = [];

  const systemPrompt = `You are MCP Operator, an autonomous agent.
Your mission: ${mission}

Connected integrations: ${config.enabledIntegrations.join(", ") || "none"}

When triggered, analyze the situation and take action according to your mission.
Use the tools available to you. Be concise — act, then briefly summarize what you did.
Do not ask for confirmation. Just act.`;

  const userMessage = context
    ? `Trigger: ${trigger}\n\n${context}`
    : `Trigger: ${trigger}. Perform your mission.`;

  try {
    const result = await generateText({
      model: getModel(config),
      system: systemPrompt,
      prompt: userMessage,
      stopWhen: stepCountIs(5),
      tools: buildTools(config),
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
  }
}

function buildTools(config: MCPConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, Tool<any, any>> = {};

  // Discord
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

  // GitHub
  if (config.githubToken) {
    tools.get_github_prs = tool<
      { repo: string; state: string },
      { ok: boolean; prs: unknown[] }
    >({
      description: "Get pull requests from a GitHub repository",
      inputSchema: zodSchema(
        z.object({
          repo: z.string().describe("Repository in owner/repo format"),
          state: z.enum(["open", "closed", "all"]).describe("PR state filter"),
        })
      ),
      execute: async ({ repo, state }) => {
        const target = repo || config.githubRepo;
        const res = await fetch(
          `https://api.github.com/repos/${target}/pulls?state=${state}&per_page=10`,
          {
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              "User-Agent": "mcp-operator",
            },
          }
        );
        if (!res.ok) return { ok: false, prs: [] };
        const prs = await res.json();
        return { ok: true, prs };
      },
    });

    tools.get_github_events = tool<{ repo: string }, { ok: boolean; events: unknown[] }>({
      description: "Get recent events from a GitHub repository",
      inputSchema: zodSchema(
        z.object({ repo: z.string().describe("Repository in owner/repo format") })
      ),
      execute: async ({ repo }) => {
        const target = repo || config.githubRepo;
        const res = await fetch(
          `https://api.github.com/repos/${target}/events?per_page=10`,
          {
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              "User-Agent": "mcp-operator",
            },
          }
        );
        if (!res.ok) return { ok: false, events: [] };
        const events = await res.json();
        return { ok: true, events };
      },
    });

    tools.create_github_issue = tool<
      { repo: string; title: string; body: string },
      { ok: boolean; url: string }
    >({
      description: "Create a GitHub issue in a repository",
      inputSchema: zodSchema(
        z.object({
          repo: z.string().describe("Repository in owner/repo format"),
          title: z.string().describe("Issue title"),
          body: z.string().describe("Issue body (markdown supported)"),
        })
      ),
      execute: async ({ repo, title, body }) => {
        const target = repo || config.githubRepo;
        const res = await fetch(`https://api.github.com/repos/${target}/issues`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            "User-Agent": "mcp-operator",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, body }),
        });
        if (!res.ok) return { ok: false, url: "" };
        const issue = await res.json();
        return { ok: true, url: issue.html_url };
      },
    });
  }

  return tools;
}
