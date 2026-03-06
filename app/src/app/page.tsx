export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { readConfig } from "@/lib/config";
import RunNowButton from "@/components/RunNowButton";

const INTEGRATION_LABELS: Record<string, string> = {
  discord: "Discord",
  github: "GitHub",
  slack: "Slack",
  google_sheets: "Google Sheets",
  hubspot: "HubSpot",
  stripe: "Stripe",
  airtable: "Airtable",
  notion: "Notion",
  sendgrid: "SendGrid",
};

const AI_PROVIDER_LABELS: Record<string, string> = {
  google: "Google Gemini",
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
};

export default function Dashboard() {
  const config = readConfig();

  if (!config.setupComplete) {
    redirect("/setup");
  }

  const integrations = config.enabledIntegrations ?? [];
  const aiLabel =
    config.aiProvider ? AI_PROVIDER_LABELS[config.aiProvider] ?? config.aiProvider : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold tracking-wide">MCP Operator</span>
          </div>
          <div className="flex items-center gap-2">
            <RunNowButton />
            <Link
              href="/settings"
              className="flex items-center gap-2 border border-zinc-700 text-zinc-300 rounded-lg px-4 py-2 text-sm font-medium hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* Mission */}
        <section>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-medium">
            Mission
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-5 py-4">
            {config.agentMission ? (
              <p className="text-zinc-200 leading-relaxed">{config.agentMission}</p>
            ) : (
              <p className="text-zinc-500 italic">No mission defined yet.</p>
            )}
          </div>
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Platforms"
            value={integrations.length.toString()}
            sub={integrations.length === 1 ? "connected" : "connected"}
          />
          <StatCard
            label="Schedule"
            value={`${config.cronIntervalMinutes ?? 5}m`}
            sub="check interval"
          />
          <StatCard
            label="AI Model"
            value={aiLabel ?? "—"}
            sub={config.aiProvider ? "provider" : "not configured"}
          />
        </div>

        {/* Connected platforms */}
        <section>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-medium">
            Connected Platforms
          </p>
          {integrations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {integrations.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-sm text-zinc-200">
                    {INTEGRATION_LABELS[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-5 py-4">
              <p className="text-zinc-500 text-sm italic">No platforms connected.</p>
            </div>
          )}
        </section>

        {/* Activity log placeholder */}
        <section>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-medium">
            Recent Activity
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-5 py-8 text-center">
            <p className="text-zinc-500 text-sm">
              No runs yet — the agent will check in every{" "}
              <span className="text-zinc-300">{config.cronIntervalMinutes ?? 5} minutes</span>.
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              Hit &ldquo;Run Now&rdquo; above to trigger a manual run.
            </p>
          </div>
        </section>

        {/* Re-setup link */}
        <div className="text-center pt-2">
          <Link
            href="/setup"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Re-run setup chat →
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-5 py-4">
      <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-zinc-100 leading-none mb-1">{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
