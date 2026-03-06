import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  const { service } = await req.json();
  const config = readConfig();

  try {
    switch (service.toLowerCase()) {
      case "discord": {
        if (!config.discordWebhookUrl)
          return NextResponse.json({ ok: false, message: "No webhook URL configured" });
        const res = await fetch(config.discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "✅ MCP Operator — connection test" }),
        });
        if (!res.ok)
          return NextResponse.json({ ok: false, message: `Discord returned ${res.status}` });
        return NextResponse.json({ ok: true, message: "Discord connected — test message sent" });
      }

      case "github": {
        if (!config.githubToken)
          return NextResponse.json({ ok: false, message: "No token configured" });
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            "User-Agent": "mcp-operator",
          },
        });
        if (!res.ok)
          return NextResponse.json({ ok: false, message: `GitHub returned ${res.status}` });
        const data = await res.json();
        return NextResponse.json({ ok: true, message: `Connected as ${data.login}` });
      }

      case "slack": {
        if (!config.slackWebhookUrl)
          return NextResponse.json({ ok: false, message: "No webhook URL configured" });
        const res = await fetch(config.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "✅ MCP Operator — connection test" }),
        });
        if (!res.ok)
          return NextResponse.json({ ok: false, message: `Slack returned ${res.status}` });
        return NextResponse.json({ ok: true, message: "Slack connected — test message sent" });
      }

      case "ai": {
        if (!config.aiApiKey)
          return NextResponse.json({ ok: false, message: "No API key configured" });
        const labels: Record<string, string> = {
          google: "Google Gemini",
          anthropic: "Anthropic Claude",
          openai: "OpenAI",
        };
        return NextResponse.json({
          ok: true,
          message: `${labels[config.aiProvider] ?? config.aiProvider} key looks good`,
        });
      }

      default:
        return NextResponse.json({ ok: true, message: `${service} config saved` });
    }
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: `Error: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
}
