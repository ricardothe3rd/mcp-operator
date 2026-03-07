export const dynamic = "force-dynamic";

import { readConfig } from "@/lib/config";
import { readActivity, type ActivityEntry } from "@/lib/activity";
import { auth } from "@/auth";
import DashboardClient from "./DashboardClient";

const CREDENTIAL_FIELDS = [
  "discordWebhookUrl", "githubToken", "slackWebhookUrl",
  "googleSheetsApiKey", "hubspotApiKey", "stripeApiKey",
  "airtableApiKey", "notionApiKey", "sendgridApiKey", "aiApiKey",
] as const;

export interface DashboardStats {
  apiKeyCount: number;
  totalFlows: number;
  activeCount: number;
  failedCount: number;
}

export interface SerializedConfig {
  setupComplete: boolean;
  agentMission: string;
  cronIntervalMinutes: number;
  enabledIntegrations: string[];
  aiProvider: string;
  discordWebhookUrl: string;
  githubToken: string;
  slackWebhookUrl: string;
  googleSheetsApiKey: string;
  hubspotApiKey: string;
  stripeApiKey: string;
  airtableApiKey: string;
  notionApiKey: string;
  sendgridApiKey: string;
  aiApiKey: string;
}

export default async function Dashboard() {
  const session = await auth();
  const config = readConfig();
  const activity: ActivityEntry[] = readActivity(50);

  const apiKeyCount = CREDENTIAL_FIELDS.filter((f) => !!config[f]).length;
  const cutoff = Date.now() - 86_400_000;
  const activeCount = activity.filter(
    (e) => e.success && new Date(e.timestamp).getTime() > cutoff
  ).length;
  const failedCount = activity.filter(
    (e) => !e.success && new Date(e.timestamp).getTime() > cutoff
  ).length;

  const stats: DashboardStats = {
    apiKeyCount,
    totalFlows: activity.length,
    activeCount,
    failedCount,
  };

  const serializedConfig: SerializedConfig = {
    setupComplete: config.setupComplete,
    agentMission: config.agentMission,
    cronIntervalMinutes: config.cronIntervalMinutes,
    enabledIntegrations: config.enabledIntegrations ?? [],
    aiProvider: config.aiProvider ?? "",
    discordWebhookUrl: config.discordWebhookUrl ?? "",
    githubToken: config.githubToken ?? "",
    slackWebhookUrl: config.slackWebhookUrl ?? "",
    googleSheetsApiKey: config.googleSheetsApiKey ?? "",
    hubspotApiKey: config.hubspotApiKey ?? "",
    stripeApiKey: config.stripeApiKey ?? "",
    airtableApiKey: config.airtableApiKey ?? "",
    notionApiKey: config.notionApiKey ?? "",
    sendgridApiKey: config.sendgridApiKey ?? "",
    aiApiKey: config.aiApiKey ?? "",
  };

  return (
    <DashboardClient
      config={serializedConfig}
      activity={activity}
      stats={stats}
      userName={session?.user?.name ?? null}
      userEmail={session?.user?.email ?? null}
      userImage={session?.user?.image ?? null}
    />
  );
}
