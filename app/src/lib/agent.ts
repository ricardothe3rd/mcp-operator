import { generateText, tool, stepCountIs, zodSchema, type Tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createOllama } from "ai-sdk-ollama";
import { z } from "zod";
import { readConfig, MCPConfig } from "./config";
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
      // Zero-config fallback — try Ollama first (no key needed)
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

  const knowledgeContext = buildKnowledgeContext(`${mission} ${trigger}`);

  // Load MCP tools (GitHub, Discord, Airtable, Resend) + hardcoded tools (Slack)
  const { tools: mcpTools, cleanup } = await loadMCPTools(config);
  const hardcodedTools = buildHardcodedTools(config);
  // MCP tools win on collision
  const tools = { ...hardcodedTools, ...mcpTools };

  try {
    const result = await generateText({
      model: getModel(config),
      system: systemPrompt + knowledgeContext,
      prompt: userMessage,
      stopWhen: stepCountIs(5),
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

/** Hardcoded tools for integrations not yet covered by an MCP server (Slack). */
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

  return tools;
}
