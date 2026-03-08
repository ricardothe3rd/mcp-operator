import { supabase } from "./supabase";

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
  githubRepo: string;

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
  airtableTableNames: string[];

  // Notion
  notionApiKey: string;

  // SendGrid
  sendgridApiKey: string;

  // Resend
  resendApiKey: string;

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
  resendApiKey: "",

  aiProvider: "",
  aiApiKey: "",
  aiModel: "",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
};

// In-process cache so synchronous callers (agent.ts, etc.) get a fast read
let _cache: MCPConfig | null = null;

export function readConfig(): MCPConfig {
  return _cache ?? DEFAULTS;
}

export async function loadConfig(): Promise<MCPConfig> {
  const { data } = await supabase
    .from("config")
    .select("data")
    .eq("id", 1)
    .single();
  _cache = { ...DEFAULTS, ...((data?.data as Partial<MCPConfig>) ?? {}) };
  return _cache;
}

export async function writeConfig(patch: Partial<MCPConfig>): Promise<MCPConfig> {
  const current = await loadConfig();
  const updated = { ...current, ...patch };
  await supabase.from("config").upsert({ id: 1, data: updated });
  _cache = updated;
  return updated;
}
