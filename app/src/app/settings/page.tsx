"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TestStatus = "idle" | "testing" | "ok" | "error";

interface ServiceConfig {
  label: string;
  service: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
  testable: boolean;
}

const SERVICES: ServiceConfig[] = [
  {
    label: "Discord",
    service: "discord",
    fields: [{ key: "discordWebhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." }],
    testable: true,
  },
  {
    label: "GitHub",
    service: "github",
    fields: [
      { key: "githubToken", label: "Personal Access Token", placeholder: "ghp_...", type: "password" },
      { key: "githubRepo", label: "Repository", placeholder: "owner/repo" },
    ],
    testable: true,
  },
  {
    label: "Slack",
    service: "slack",
    fields: [{ key: "slackWebhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." }],
    testable: true,
  },
  {
    label: "Google Sheets",
    service: "google_sheets",
    fields: [
      { key: "googleSheetsApiKey", label: "API Key", placeholder: "AIzaSy...", type: "password" },
      { key: "googleSpreadsheetId", label: "Spreadsheet ID", placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" },
    ],
    testable: false,
  },
  {
    label: "HubSpot",
    service: "hubspot",
    fields: [{ key: "hubspotApiKey", label: "API Key", placeholder: "pat-na1-...", type: "password" }],
    testable: false,
  },
  {
    label: "Stripe",
    service: "stripe",
    fields: [{ key: "stripeApiKey", label: "Secret Key", placeholder: "sk_live_...", type: "password" }],
    testable: false,
  },
  {
    label: "Airtable",
    service: "airtable",
    fields: [
      { key: "airtableApiKey", label: "API Key", placeholder: "pat...", type: "password" },
      { key: "airtableBaseId", label: "Base ID", placeholder: "app..." },
    ],
    testable: false,
  },
  {
    label: "Notion",
    service: "notion",
    fields: [{ key: "notionApiKey", label: "Integration Secret", placeholder: "secret_...", type: "password" }],
    testable: false,
  },
  {
    label: "SendGrid",
    service: "sendgrid",
    fields: [{ key: "sendgridApiKey", label: "API Key", placeholder: "SG...", type: "password" }],
    testable: false,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [cronInterval, setCronInterval] = useState(5);
  const [agentMission, setAgentMission] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const v: Record<string, string> = {};
    for (const svc of SERVICES) {
      for (const f of svc.fields) {
        v[f.key] = data[f.key] ?? "";
      }
    }
    setValues(v);
    setAiProvider(data.aiProvider ?? "");
    setAiApiKey(data.aiApiKey ?? "");
    setCronInterval(data.cronIntervalMinutes ?? 5);
    setAgentMission(data.agentMission ?? "");
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveService = async (service: ServiceConfig) => {
    setSaving((s) => ({ ...s, [service.service]: true }));
    const body: Record<string, string> = {};
    for (const f of service.fields) {
      body[f.key] = values[f.key] ?? "";
    }
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving((s) => ({ ...s, [service.service]: false }));
  };

  const testService = async (service: string) => {
    setTestStatus((s) => ({ ...s, [service]: "testing" }));
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    const data = await res.json();
    setTestStatus((s) => ({ ...s, [service]: data.ok ? "ok" : "error" }));
    setTestMsg((s) => ({ ...s, [service]: data.message }));
  };

  const saveAI = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiProvider, aiApiKey, cronIntervalMinutes: cronInterval, agentMission }),
    });
  };

  const skipSetup = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupComplete: true }),
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
            <span className="text-zinc-700">/</span>
            <span className="text-sm font-semibold">Settings</span>
          </div>
          <button
            onClick={skipSetup}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Mark as configured
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Agent config */}
        <Section title="Agent">
          <Field label="Mission">
            <textarea
              value={agentMission}
              onChange={(e) => setAgentMission(e.target.value)}
              rows={3}
              placeholder="Describe what you want the agent to do..."
              className={inputCls + " resize-none"}
            />
          </Field>
          <Field label="Check interval (minutes)">
            <input
              type="number"
              value={cronInterval}
              onChange={(e) => setCronInterval(Number(e.target.value))}
              min={1}
              className={inputCls}
            />
          </Field>
          <Field label="AI Provider">
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className={inputCls}
            >
              <option value="">Select provider</option>
              <option value="google">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </Field>
          <Field label="AI API Key">
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="Paste your API key..."
              className={inputCls}
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <SaveBtn onClick={saveAI} />
            <TestBtn
              onClick={() => testService("ai")}
              status={testStatus["ai"] ?? "idle"}
              msg={testMsg["ai"]}
            />
          </div>
        </Section>

        {/* Per-service sections */}
        {SERVICES.map((svc) => (
          <Section key={svc.service} title={svc.label}>
            {svc.fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type={f.type ?? "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              </Field>
            ))}
            <div className="flex gap-2 pt-1">
              <SaveBtn
                onClick={() => saveService(svc)}
                loading={saving[svc.service]}
              />
              {svc.testable && (
                <TestBtn
                  onClick={() => testService(svc.service)}
                  status={testStatus[svc.service] ?? "idle"}
                  msg={testMsg[svc.service]}
                />
              )}
            </div>
          </Section>
        ))}

        <div className="text-center pt-4">
          <Link href="/setup" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Re-run setup chat →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-medium">{title}</p>
      <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-5 space-y-4">
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? "Saving..." : "Save"}
    </button>
  );
}

function TestBtn({ onClick, status, msg }: { onClick: () => void; status: TestStatus; msg?: string }) {
  const label =
    status === "testing" ? "Testing..." :
    status === "ok" ? "✓ " + (msg ?? "Connected") :
    status === "error" ? "✗ " + (msg ?? "Failed") :
    "Test";

  const cls =
    status === "ok" ? "text-emerald-400 border-emerald-800" :
    status === "error" ? "text-red-400 border-red-800" :
    "text-zinc-400 border-zinc-700 hover:border-zinc-500";

  return (
    <button
      onClick={onClick}
      disabled={status === "testing"}
      className={`text-sm border px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}

const inputCls =
  "w-full bg-zinc-900/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
