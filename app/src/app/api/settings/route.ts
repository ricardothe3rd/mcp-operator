import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config";

function maskKey(value: string): string {
  if (!value || value.length < 8) return value ? "••••••••" : "";
  return "••••" + value.slice(-4);
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json({
    setupComplete: config.setupComplete,
    agentMission: config.agentMission,
    cronIntervalMinutes: config.cronIntervalMinutes,
    enabledIntegrations: config.enabledIntegrations,
    aiProvider: config.aiProvider,
    aiModel: config.aiModel,
    aiApiKey: maskKey(config.aiApiKey),
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
    notionApiKey: maskKey(config.notionApiKey),
    sendgridApiKey: maskKey(config.sendgridApiKey),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Only allow known config keys, reject masked values
  const safeBody: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.startsWith("••••")) continue;
    safeBody[key] = value;
  }
  const updated = writeConfig(safeBody);
  return NextResponse.json({ ok: true, setupComplete: updated.setupComplete });
}
