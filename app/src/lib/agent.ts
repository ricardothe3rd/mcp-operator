import { readConfig } from "./config";

export interface AgentResult {
  success: boolean;
  message: string;
  actions: string[];
}

const FALLBACK_MISSION =
  "Monitor connected platforms, report on activity, and take action when relevant events occur.";

export async function runAgent(
  trigger: string,
  context?: string
): Promise<AgentResult> {
  const config = readConfig();
  const mission = config.agentMission || FALLBACK_MISSION;
  const actions: string[] = [];

  console.log(`[MCP Operator] Agent triggered: ${trigger}`);
  console.log(`[MCP Operator] Mission: ${mission}`);

  // Build the system prompt from the user's mission
  const systemPrompt = `You are MCP Operator, an autonomous agent.
Your mission: ${mission}

You have access to the following connected integrations: ${
    config.enabledIntegrations.length > 0
      ? config.enabledIntegrations.join(", ")
      : "none configured yet"
  }

When triggered, analyze the situation and take appropriate action based on your mission.
Be concise in your actions. Report what you did.`;

  const userMessage = context
    ? `Trigger: ${trigger}\nContext: ${context}`
    : `Trigger: ${trigger}`;

  // TODO: Wire up actual AI SDK calls + tool execution in Phase 6
  // For now, log and return a placeholder
  console.log(`[MCP Operator] System: ${systemPrompt}`);
  console.log(`[MCP Operator] User: ${userMessage}`);

  actions.push(`Received trigger: ${trigger}`);
  actions.push(`Mission active: ${mission.slice(0, 60)}...`);

  return {
    success: true,
    message: `Agent ran successfully for trigger: ${trigger}`,
    actions,
  };
}
