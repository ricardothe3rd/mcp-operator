import path from "path";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { MCPConfig } from "./config";

interface MCPTools {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Record<string, any>;
  cleanup: () => Promise<void>;
}

export async function loadMCPTools(config: MCPConfig): Promise<MCPTools> {
  // Vercel serverless cannot spawn child processes reliably — skip MCP loading
  // and let agent.ts fallback tools handle all integrations.
  if (process.env.VERCEL) {
    return { tools: {}, cleanup: async () => {} };
  }

  const clients: Awaited<ReturnType<typeof createMCPClient>>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolMaps: Record<string, any>[] = [];

  async function spawnClient(
    command: string,
    args: string[],
    env: Record<string, string>
  ) {
    const transport = new Experimental_StdioMCPTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    });
    const client = await createMCPClient({ transport });
    clients.push(client);
    return client;
  }

  // GitHub
  if (config.githubToken && config.enabledIntegrations.includes("github")) {
    try {
      const client = await spawnClient("npx", ["-y", "@modelcontextprotocol/server-github"], {
        GITHUB_PERSONAL_ACCESS_TOKEN: config.githubToken,
      });
      toolMaps.push(await client.tools());
    } catch (err) {
      console.warn("[mcp-loader] GitHub MCP unavailable — using fallback tools:", (err as Error).message);
    }
  }

  // Discord
  if (config.discordWebhookUrl && config.enabledIntegrations.includes("discord")) {
    try {
      // Use local build until published to npm; process.cwd() = app/ dir
      const discordMcpPath = path.resolve(
        process.cwd(),
        "../../mcp-discord-webhook/dist/index.js"
      );
      const client = await spawnClient("node", [discordMcpPath], {
        DISCORD_WEBHOOK_URL: config.discordWebhookUrl,
      });
      toolMaps.push(await client.tools());
    } catch (err) {
      console.warn("[mcp-loader] Discord MCP unavailable — using fallback tools:", (err as Error).message);
    }
  }

  // Airtable
  if (config.airtableApiKey && config.enabledIntegrations.includes("airtable")) {
    try {
      const client = await spawnClient("npx", ["-y", "airtable-mcp-server"], {
        AIRTABLE_API_KEY: config.airtableApiKey,
        AIRTABLE_BASE_ID: config.airtableBaseId,
      });
      toolMaps.push(await client.tools());
    } catch (err) {
      console.warn("[mcp-loader] Airtable MCP unavailable — using fallback tools:", (err as Error).message);
    }
  }

  // Resend
  if (config.resendApiKey && config.enabledIntegrations.includes("resend")) {
    try {
      const client = await spawnClient("npx", ["-y", "resend-mcp"], {
        RESEND_API_KEY: config.resendApiKey,
      });
      toolMaps.push(await client.tools());
    } catch (err) {
      console.warn("[mcp-loader] Resend MCP unavailable — using fallback tools:", (err as Error).message);
    }
  }

  const tools = Object.assign({}, ...toolMaps);

  const cleanup = async () => {
    await Promise.allSettled(clients.map((c) => c.close()));
  };

  return { tools, cleanup };
}
