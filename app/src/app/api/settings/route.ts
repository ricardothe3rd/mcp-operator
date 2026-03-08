import { NextRequest, NextResponse } from "next/server";
import { loadConfig, writeConfig } from "@/lib/config";

// Explicit allowlist — only these keys may be written via the API
const ALLOWED_KEYS = new Set([
  "setupComplete",
  "agentMission",
  "cronIntervalMinutes",
  "enabledIntegrations",
  "aiProvider",
  "aiApiKey",
  "aiModel",
  "ollamaBaseUrl",
  "ollamaModel",
  "discordWebhookUrl",
  "githubToken",
  "githubRepo",
  "slackWebhookUrl",
  "googleSheetsApiKey",
  "googleSpreadsheetId",
  "hubspotApiKey",
  "stripeApiKey",
  "airtableApiKey",
  "airtableBaseId",
  "airtableTableNames",
  "notionApiKey",
  "sendgridApiKey",
  "resendApiKey",
]);

function maskKey(value: string): string {
  if (!value || value.length < 8) return value ? "••••••••" : "";
  return "••••" + value.slice(-4);
}

// Auth enforced by middleware
export async function GET() {
  const config = await loadConfig();
  return NextResponse.json({
    setupComplete: config.setupComplete,
    agentMission: config.agentMission,
    cronIntervalMinutes: config.cronIntervalMinutes,
    enabledIntegrations: config.enabledIntegrations,
    aiProvider: config.aiProvider,
    aiModel: config.aiModel,
    aiApiKey: maskKey(config.aiApiKey),
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
    discordWebhookUrl: maskKey(config.discordWebhookUrl),
    githubToken: maskKey(config.githubToken),
    githubRepo: config.githubRepo,
    slackWebhookUrl: maskKey(config.slackWebhookUrl),
    googleSheetsApiKey: maskKey(config.googleSheetsApiKey),
    googleSpreadsheetId: config.googleSpreadsheetId,
    hubspotApiKey: maskKey(config.hubspotApiKey),
    stripeApiKey: maskKey(config.stripeApiKey),
    airtableApiKey: maskKey(config.airtableApiKey),
    airtableBaseId: config.airtableBaseId,
    airtableTableNames: config.airtableTableNames,
    notionApiKey: maskKey(config.notionApiKey),
    sendgridApiKey: maskKey(config.sendgridApiKey),
    resendApiKey: maskKey(config.resendApiKey),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const safeBody: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    // Block keys not in whitelist
    if (!ALLOWED_KEYS.has(key)) continue;
    // Block masked placeholder values
    if (typeof value === "string" && value.startsWith("••••")) continue;
    // Clamp cron interval to sane range
    if (key === "cronIntervalMinutes") {
      safeBody[key] = Math.max(1, Math.min(1440, Number(value) || 5));
      continue;
    }
    safeBody[key] = value;
  }

  const updated = await writeConfig(safeBody);
  return NextResponse.json({ ok: true, setupComplete: updated.setupComplete });
}
