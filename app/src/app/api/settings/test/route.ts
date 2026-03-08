import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

const ALLOWED_SERVICES = new Set(["discord", "github", "slack", "ai"]);

// Auth enforced by middleware
export async function POST(req: NextRequest) {
  const { service } = await req.json();

  // Whitelist — reject unknown service names
  if (!ALLOWED_SERVICES.has(String(service).toLowerCase())) {
    return NextResponse.json({ ok: false, message: "Unknown service" }, { status: 400 });
  }

  const config = await loadConfig();

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
        // Don't leak username — just confirm connected
        return NextResponse.json({ ok: true, message: "GitHub token is valid" });
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
          message: `${labels[config.aiProvider] ?? "AI"} key saved`,
        });
      }

      default:
        return NextResponse.json({ ok: false, message: "Unknown service" }, { status: 400 });
    }
  } catch {
    // Don't expose internal error details
    return NextResponse.json({ ok: false, message: "Connection test failed" });
  }
}
