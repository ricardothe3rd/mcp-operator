import fs from "fs";
import path from "path";

export interface MCPConfig {
  // Setup state
  setupComplete: boolean;
  agentMission: string;
  cronIntervalMinutes: number;
  enabledIntegrations: string[];

  // Discord
  discordWebhookUrl: string;

  // GitHub
  githubToken: string;
  githubRepo: string; // "owner/repo"

  // Google Sheets
  googleSheetsApiKey: string;
  googleSpreadsheetId: string;

  // Slack
  slackWebhookUrl: string;

  // HubSpot
  hubspotApiKey: string;

  // Stripe
  stripeApiKey: string;

  // Airtable
  airtableApiKey: string;
  airtableBaseId: string;
  airtableTableNames: string[]; // all selected tables the agent can use

  // Notion
  notionApiKey: string;

  // SendGrid
  sendgridApiKey: string;

  // AI provider
  aiProvider: "google" | "openai" | "anthropic" | "groq" | "ollama" | "";
  aiApiKey: string;
  aiModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

const DEFAULTS: MCPConfig = {
  setupComplete: false,
  agentMission: "",
  cronIntervalMinutes: 5,
  enabledIntegrations: [],

  discordWebhookUrl: "",
  githubToken: "",
  githubRepo: "",
  googleSheetsApiKey: "",
  googleSpreadsheetId: "",
  slackWebhookUrl: "",
  hubspotApiKey: "",
  stripeApiKey: "",
  airtableApiKey: "",
  airtableBaseId: "",
  airtableTableNames: [],
  notionApiKey: "",
  sendgridApiKey: "",

  aiProvider: "",
  aiApiKey: "",
  aiModel: "",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
};

const CONFIG_PATH = path.join(process.cwd(), "mcp-operator.config.json");

export function readConfig(): MCPConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      writeConfig(DEFAULTS);
      return DEFAULTS;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function writeConfig(config: Partial<MCPConfig>): MCPConfig {
  const current = readConfig();
  const updated = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}
