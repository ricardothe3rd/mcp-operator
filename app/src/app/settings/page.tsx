"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type TestStatus = "idle" | "testing" | "ok" | "error";

interface ServiceConfig {
  id: string;
  label: string;
  service: string;
  icon: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
  testable: boolean;
}

const SERVICES: ServiceConfig[] = [
  {
    id: "discord", label: "Discord", service: "discord", icon: "🎮",
    fields: [{ key: "discordWebhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." }],
    testable: true,
  },
  {
    id: "github", label: "GitHub", service: "github", icon: "🐙",
    fields: [
      { key: "githubToken", label: "Personal Access Token", placeholder: "ghp_…", type: "password" },
      { key: "githubRepo", label: "Repository", placeholder: "owner/repo" },
    ],
    testable: true,
  },
  {
    id: "slack", label: "Slack", service: "slack", icon: "💬",
    fields: [{ key: "slackWebhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/…" }],
    testable: true,
  },
  {
    id: "google_sheets", label: "Google Sheets", service: "google_sheets", icon: "📊",
    fields: [
      { key: "googleSheetsApiKey", label: "API Key", placeholder: "AIzaSy…", type: "password" },
      { key: "googleSpreadsheetId", label: "Spreadsheet ID", placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" },
    ],
    testable: false,
  },
  {
    id: "hubspot", label: "HubSpot", service: "hubspot", icon: "🔶",
    fields: [{ key: "hubspotApiKey", label: "API Key", placeholder: "pat-na1-…", type: "password" }],
    testable: false,
  },
  {
    id: "stripe", label: "Stripe", service: "stripe", icon: "💳",
    fields: [{ key: "stripeApiKey", label: "Secret Key", placeholder: "sk_live_…", type: "password" }],
    testable: false,
  },
  {
    id: "airtable", label: "Airtable", service: "airtable", icon: "🗂️",
    fields: [
      { key: "airtableApiKey", label: "API Key", placeholder: "pat…", type: "password" },
      { key: "airtableBaseId", label: "Base ID", placeholder: "appXXXXXXXXXXXXXX" },
    ],
    testable: false,
  },
  {
    id: "notion", label: "Notion", service: "notion", icon: "📝",
    fields: [{ key: "notionApiKey", label: "Integration Secret", placeholder: "secret_…", type: "password" }],
    testable: false,
  },
  {
    id: "sendgrid", label: "SendGrid", service: "sendgrid", icon: "📧",
    fields: [{ key: "sendgridApiKey", label: "API Key", placeholder: "SG…", type: "password" }],
    testable: false,
  },
  {
    id: "resend", label: "Resend", service: "resend", icon: "✉️",
    fields: [{ key: "resendApiKey", label: "API Key", placeholder: "re_…", type: "password" }],
    testable: false,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [cronInterval, setCronInterval] = useState(5);
  const [agentMission, setAgentMission] = useState("");
  const [activeSection, setActiveSection] = useState("agent");
  const [airtableTables, setAirtableTables] = useState<{ id: string; name: string }[]>([]);
  const [airtableTablesLoading, setAirtableTablesLoading] = useState(false);
  const [airtableTablesError, setAirtableTablesError] = useState("");
  const [airtableTableNames, setAirtableTableNames] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const v: Record<string, string> = {};
    for (const svc of SERVICES) {
      for (const f of svc.fields) v[f.key] = data[f.key] ?? "";
    }
    setValues(v);
    setAiProvider(data.aiProvider ?? "");
    setAiApiKey(data.aiApiKey ?? "");
    setOllamaBaseUrl(data.ollamaBaseUrl ?? "http://localhost:11434");
    setOllamaModel(data.ollamaModel ?? "llama3.2");
    setCronInterval(data.cronIntervalMinutes ?? 5);
    setAgentMission(data.agentMission ?? "");
    setAirtableTableNames(data.airtableTableNames ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fetchAirtableTables = async () => {
    setAirtableTablesLoading(true);
    setAirtableTablesError("");
    try {
      const apiKey = values["airtableApiKey"];
      const baseId = values["airtableBaseId"];
      // Pass params only if they aren't masked — server uses saved config as fallback
      const params = new URLSearchParams();
      if (apiKey && !apiKey.startsWith("••••")) params.set("apiKey", apiKey);
      if (baseId && !baseId.startsWith("••••")) params.set("baseId", baseId);
      const res = await fetch(`/api/settings/airtable-tables?${params}`);
      const data = await res.json();
      if (data.tables) {
        setAirtableTables(data.tables);
      } else {
        setAirtableTablesError(data.error ?? "Failed to load tables");
      }
    } catch {
      setAirtableTablesError("Network error");
    }
    setAirtableTablesLoading(false);
  };

  const toggleAirtableTable = (name: string) => {
    setAirtableTableNames((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const saveService = async (service: ServiceConfig) => {
    setSaving((s) => ({ ...s, [service.service]: true }));
    const body: Record<string, string> = {};
    for (const f of service.fields) body[f.key] = values[f.key] ?? "";
    // Include table name when saving Airtable
    if (service.service === "airtable") body["airtableTableNames"] = airtableTableNames as unknown as string;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving((s) => ({ ...s, [service.service]: false }));
    setSaved((s) => ({ ...s, [service.service]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [service.service]: false })), 2000);
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
    setSaving((s) => ({ ...s, agent: true }));
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiProvider, aiApiKey, ollamaBaseUrl, ollamaModel, cronIntervalMinutes: cronInterval, agentMission }),
    });
    setSaving((s) => ({ ...s, agent: false }));
    setSaved((s) => ({ ...s, agent: true }));
    setTimeout(() => setSaved((s) => ({ ...s, agent: false })), 2000);
  };

  const skipSetup = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupComplete: true }),
    });
    router.push("/dashboard");
  };

  const isConfigured = (svc: ServiceConfig) => svc.fields.every((f) => !!values[f.key]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-card px-6 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
              ← Dashboard
            </Link>
            <span className="text-border">/</span>
            <span className="font-semibold">Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={skipSetup}>
              Mark as configured
            </Button>
            <UserMenu
              name={session?.user?.name}
              email={session?.user?.email}
              image={session?.user?.image}
            />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
        {/* Sticky left nav */}
        <aside className="w-48 shrink-0 hidden md:block">
          <nav className="sticky top-20 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium px-3 mb-2">
              Sections
            </p>
            <NavItem active={activeSection === "agent"} onClick={() => scrollTo("agent")} icon="⚡" label="Agent" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium px-3 mt-4 mb-2">
              Integrations
            </p>
            {SERVICES.map((svc) => (
              <NavItem
                key={svc.id}
                active={activeSection === svc.id}
                onClick={() => scrollTo(svc.id)}
                icon={svc.icon}
                label={svc.label}
                configured={isConfigured(svc)}
              />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Agent section */}
          <section id="section-agent" className="scroll-mt-20">
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-base">⚡</span>
                    <div>
                      <CardTitle className="text-sm">Agent</CardTitle>
                      <CardDescription>Configure your agent&apos;s mission and AI model</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <FieldGroup label="Mission">
                  <Textarea
                    value={agentMission}
                    onChange={(e) => setAgentMission(e.target.value)}
                    placeholder="Describe what you want the agent to do…"
                    className="resize-none min-h-[80px]"
                  />
                </FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Check interval (minutes)">
                    <Input
                      type="number"
                      value={cronInterval}
                      onChange={(e) => setCronInterval(Number(e.target.value))}
                      min={1}
                    />
                  </FieldGroup>
                  <FieldGroup label="AI Provider">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors"
                    >
                      <option value="">Auto-detect</option>
                      <option value="ollama">🦙 Ollama (local, free)</option>
                      <option value="groq">⚡ Groq (free key)</option>
                      <option value="google">Google Gemini</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </FieldGroup>
                </div>

                {/* Ollama-specific fields */}
                {aiProvider === "ollama" && (
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border border-border/60 bg-muted/20">
                    <FieldGroup label="Ollama URL">
                      <Input
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                      />
                    </FieldGroup>
                    <FieldGroup label="Model">
                      <select
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors"
                      >
                        <option value="llama3.2">llama3.2 (2 GB) — recommended</option>
                        <option value="llama3.1:8b">llama3.1:8b (4.7 GB) — more capable</option>
                        <option value="qwen2.5:7b">qwen2.5:7b (4.7 GB) — best tool calling</option>
                        <option value="mistral">mistral (4.1 GB)</option>
                        <option value="phi4">phi4 (9.1 GB)</option>
                      </select>
                    </FieldGroup>
                    <div className="col-span-2">
                      <p className="text-[11px] text-muted-foreground">
                        Make sure Ollama is running: <code className="font-mono bg-muted px-1 rounded">ollama serve</code>
                        {" · "}Pull your model first: <code className="font-mono bg-muted px-1 rounded">ollama pull {ollamaModel}</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* API key for non-Ollama providers */}
                {aiProvider !== "ollama" && (
                  <FieldGroup label={aiProvider === "groq" ? "Groq API Key — free at console.groq.com" : "AI API Key"}>
                    <Input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiProvider === "groq" ? "gsk_…" : "Paste your API key…"}
                    />
                  </FieldGroup>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <SaveButton onClick={saveAI} loading={saving["agent"]} saved={saved["agent"]} />
                <TestButton onClick={() => testService("ai")} status={testStatus["ai"] ?? "idle"} msg={testMsg["ai"]} />
              </CardFooter>
            </Card>
          </section>

          <Separator />

          {/* Per-service sections */}
          {SERVICES.map((svc) => (
            <section key={svc.service} id={`section-${svc.id}`} className="scroll-mt-20">
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center text-base">
                        {svc.icon}
                      </span>
                      <div>
                        <CardTitle className="text-sm">{svc.label}</CardTitle>
                        <CardDescription>Connect your {svc.label} account</CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={isConfigured(svc) ? "outline" : "secondary"}
                      className={cn(isConfigured(svc) && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400")}
                    >
                      {isConfigured(svc) ? "Connected" : "Not configured"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {svc.fields.map((f) => (
                    <FieldGroup key={f.key} label={f.label}>
                      <Input
                        type={f.type ?? "text"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    </FieldGroup>
                  ))}

                  {/* Airtable table picker */}
                  {svc.service === "airtable" && (
                    <FieldGroup label="Tables the agent can use">
                      <button
                        onClick={fetchAirtableTables}
                        disabled={airtableTablesLoading}
                        className="w-full h-8 text-xs rounded-lg border border-input bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                      >
                        {airtableTablesLoading ? "Loading tables…" : "Load tables from base →"}
                      </button>

                      {airtableTablesError && (
                        <p className="text-xs text-destructive mt-1">{airtableTablesError}</p>
                      )}

                      {airtableTables.length > 0 && (
                        <div className="mt-2 border border-border rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground font-medium">{airtableTables.length} tables found — select which ones the agent can access</span>
                            <button
                              onClick={() => setAirtableTableNames(airtableTables.map(t => t.name))}
                              className="text-[11px] text-primary hover:underline"
                            >
                              Select all
                            </button>
                          </div>
                          {airtableTables.map((t) => (
                            <label
                              key={t.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer border-b border-border/50 last:border-0 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={airtableTableNames.includes(t.name)}
                                onChange={() => toggleAirtableTable(t.name)}
                                className="accent-primary w-3.5 h-3.5"
                              />
                              <span className="text-sm text-foreground">{t.name}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {airtableTableNames.length > 0 && (
                        <p className="text-[11px] text-emerald-500 mt-1">
                          {airtableTableNames.length} table{airtableTableNames.length > 1 ? "s" : ""} selected: {airtableTableNames.join(", ")}
                        </p>
                      )}
                    </FieldGroup>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <SaveButton
                    onClick={() => saveService(svc)}
                    loading={saving[svc.service]}
                    saved={saved[svc.service]}
                  />
                  {svc.testable && (
                    <TestButton
                      onClick={() => testService(svc.service)}
                      status={testStatus[svc.service] ?? "idle"}
                      msg={testMsg[svc.service]}
                    />
                  )}
                </CardFooter>
              </Card>
            </section>
          ))}

          <div className="text-center pt-4 pb-8">
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Re-run setup chat →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavItem({
  active, onClick, icon, label, configured,
}: { active: boolean; onClick: () => void; icon: string; label: string; configured?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left",
        active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="w-6 h-6 bg-muted rounded-md flex items-center justify-center text-xs shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {configured ? (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      ) : (
        <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
      )}
    </button>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  );
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading?: boolean; saved?: boolean }) {
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      variant={saved ? "outline" : "default"}
      size="sm"
      className={cn(saved && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10")}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <CheckCircle2 className="size-3.5" /> : null}
      {loading ? "Saving…" : saved ? "Saved" : "Save"}
    </Button>
  );
}

function TestButton({ onClick, status, msg }: { onClick: () => void; status: TestStatus; msg?: string }) {
  return (
    <Button
      onClick={onClick}
      disabled={status === "testing"}
      variant="outline"
      size="sm"
      className={cn(
        status === "ok" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10",
        status === "error" && "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/5"
      )}
    >
      {status === "testing" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "ok" ? (
        <CheckCircle2 className="size-3.5" />
      ) : status === "error" ? (
        <XCircle className="size-3.5" />
      ) : null}
      {status === "testing" ? "Testing…"
        : status === "ok" ? (msg ?? "Connected")
        : status === "error" ? (msg ?? "Failed")
        : "Test connection"}
    </Button>
  );
}
