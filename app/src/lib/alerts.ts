import { readConfig } from "./config";

/**
 * Sends an alert message to the first configured webhook (Discord or Slack).
 * Used when a job exceeds the consecutive failure threshold.
 */
export async function sendAlert(message: string): Promise<void> {
  const config = readConfig();

  try {
    if (config.discordWebhookUrl) {
      await fetch(config.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      return;
    }

    if (config.slackWebhookUrl) {
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
    }
  } catch (err) {
    console.error("[MCP Operator] Failed to send alert:", err);
  }
}
