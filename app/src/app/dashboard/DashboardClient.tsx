"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Plus, Link2, TestTube2, BarChart3, Loader2, Play, Square, Trash2, Zap, ChevronDown } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DashboardStats, SerializedConfig } from "./page";
import type { ActivityEntry } from "@/lib/activity";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "user" | "agent" | "tool";
  text: string;
  ok?: boolean;
};

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface ApiToolResult {
  tool: string;
  ok: boolean;
  message: string;
  redirect?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mcp-operator-sessions";

const KEY_SLOTS = [
  { service: "Discord",       field: "discordWebhookUrl",  label: "Webhook URL",     icon: "🎮" },
  { service: "GitHub",        field: "githubToken",         label: "Personal Token",  icon: "🐙" },
  { service: "Slack",         field: "slackWebhookUrl",     label: "Webhook URL",     icon: "💬" },
  { service: "Google Sheets", field: "googleSheetsApiKey",  label: "API Key",         icon: "📊" },
  { service: "HubSpot",       field: "hubspotApiKey",       label: "API Key",         icon: "🔶" },
  { service: "Stripe",        field: "stripeApiKey",        label: "API Key",         icon: "💳" },
  { service: "Airtable",      field: "airtableApiKey",      label: "API Key",         icon: "📋" },
  { service: "Notion",        field: "notionApiKey",        label: "Integration Key", icon: "📝" },
  { service: "SendGrid",      field: "sendgridApiKey",      label: "API Key",         icon: "✉️" },
  { service: "AI Provider",   field: "aiApiKey",            label: "API Key",         icon: "🤖" },
] as const;

const INTEGRATION_ICONS: Record<string, string> = {
  discord: "🎮", github: "🐙", slack: "💬", google_sheets: "📊",
  hubspot: "🔶", stripe: "💳", airtable: "📋", notion: "📝", sendgrid: "✉️",
};

const INTEGRATION_LABELS: Record<string, string> = {
  discord: "Discord", github: "GitHub", slack: "Slack",
  google_sheets: "Google Sheets", hubspot: "HubSpot", stripe: "Stripe",
  airtable: "Airtable", notion: "Notion", sendgrid: "SendGrid",
};

const INITIAL_CHAT_MESSAGE: ChatMessage = {
  id: "init",
  role: "agent",
  text: "Hi! I'm your Operator. Your agent is running.\nAsk me anything or use a quick action below.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function toApiMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.text }));
}

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  config: SerializedConfig;
  activity: ActivityEntry[];
  stats: DashboardStats;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardClient({
  config, activity, stats, userName, userEmail, userImage,
}: Props) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_CHAT_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSessions(loadSessions()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const saveCurrentSession = useCallback((msgs: ChatMessage[], sid: string | null) => {
    if (!sid) return;
    const title = msgs.find((m) => m.role === "user")?.text.slice(0, 40) ?? "New chat";
    const session: ChatSession = { id: sid, title, messages: msgs, createdAt: new Date().toISOString() };
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sid);
      const updated = idx >= 0 ? [...prev.slice(0, idx), session, ...prev.slice(idx + 1)] : [session, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    let sid = sessionId;
    if (!sid) { sid = crypto.randomUUID(); setSessionId(sid); }
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(next).slice(-10) }),
      });
      const data = await res.json();
      const newMsgs: ChatMessage[] = [];
      if (data.toolResults?.length) {
        data.toolResults.forEach((tr: ApiToolResult) => {
          newMsgs.push({ id: crypto.randomUUID(), role: "tool", ok: tr.ok, text: tr.message });
        });
      }
      if (data.reply) newMsgs.push({ id: crypto.randomUUID(), role: "agent", text: data.reply });
      const final = [...next, ...newMsgs];
      setMessages(final);
      saveCurrentSession(final, sid);
      if (data.redirectTo) setTimeout(() => router.push(data.redirectTo), 2000);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "agent", text: "Something went wrong. Please try again." },
      ]);
    } finally { setSending(false); }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary text-lg">⚡</span>
          <span className="font-semibold tracking-wide text-foreground">MCP Operator</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Settings
          </Link>
          <UserMenu name={userName} email={userEmail} image={userImage} />
        </div>
      </header>

      {/* ── Two-pane body ── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: Tabbed Panel (22%) */}
        <div className="w-[22%] shrink-0 border-r border-border flex flex-col bg-background">
          <Tabs defaultValue="overview" className="flex flex-col h-full">
            <TabsList
              variant="line"
              className="w-full justify-start rounded-none border-b border-border px-2 h-9 gap-0 bg-transparent shrink-0"
            >
              <TabsTrigger value="overview" className="px-2 text-[11px]">Overview</TabsTrigger>
              <TabsTrigger value="history"  className="px-2 text-[11px]">History</TabsTrigger>
              <TabsTrigger value="keys"     className="px-2 text-[11px]">Keys</TabsTrigger>
              <TabsTrigger value="jobs"     className="px-2 text-[11px]">Jobs</TabsTrigger>
              <TabsTrigger value="logs"     className="px-2 text-[11px]">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4"><OverviewTab config={config} activity={activity} stats={stats} /></div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4"><HistoryTab sessions={sessions} /></div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="keys" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4"><KeysTab config={config} /></div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="jobs" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3"><JobsTab /></div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="logs" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4"><LogsTab activity={activity} /></div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Chat Pane (60%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="px-5 py-5 max-w-2xl mx-auto space-y-3">
              {messages.map((msg) => {
                if (msg.role === "tool") {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border",
                        msg.ok
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border-destructive/20 bg-destructive/10 text-destructive"
                      )}>
                        {msg.ok ? "✓" : "✗"} {msg.text}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border text-foreground rounded-bl-sm"
                    )}>
                      {msg.role === "agent" && (
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-widest">
                          Operator
                        </p>
                      )}
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-3.5">
                      <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                      <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                      <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Quick action pills */}
          <div className="shrink-0 px-5 pb-2">
            <div className="max-w-2xl mx-auto flex gap-2 flex-wrap">
              <Button variant="outline" size="xs" onClick={() => setInput("Add my API key")}>
                <Plus className="size-3" /> Add API Key
              </Button>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
                <Link2 className="size-3" /> Connect Apps
              </Link>
              <Button variant="outline" size="xs" onClick={() => send("Test all connections")}>
                <TestTube2 className="size-3" /> Test All
              </Button>
              <Button variant="outline" size="xs" onClick={() => send("What is the current status?")}>
                <BarChart3 className="size-3" /> Status
              </Button>
            </div>
          </div>

          <Separator />

          {/* Input bar */}
          <div className="shrink-0 bg-card px-5 py-3">
            <div className="max-w-2xl mx-auto flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message…"
                disabled={sending}
                rows={1}
                className="flex-1 min-h-0 max-h-[120px] resize-none [field-sizing:fixed] bg-muted/50 border-border/60"
              />
              <Button onClick={() => send()} disabled={sending || !input.trim()} size="icon">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  config, activity, stats,
}: { config: SerializedConfig; activity: ActivityEntry[]; stats: DashboardStats }) {
  return (
    <div className="space-y-5">
      {/* Stat cards 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">API Keys</p>
          <p className="text-2xl font-bold text-foreground leading-none">{stats.apiKeyCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">configured</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Total Flows</p>
          <p className="text-2xl font-bold text-foreground leading-none">{stats.totalFlows}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">all time</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-medium mb-1">Active</p>
          <p className="text-2xl font-bold text-emerald-300 leading-none">{stats.activeCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">last 24h</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] text-rose-400 uppercase tracking-widest font-medium mb-1">Failed</p>
          <p className="text-2xl font-bold text-rose-300 leading-none">{stats.failedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">last 24h</p>
        </div>
      </div>

      {/* Integrations */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">Integrations</p>
        {config.enabledIntegrations.length > 0 ? (
          <div className="space-y-1.5">
            {config.enabledIntegrations.map((key) => (
              <div key={key} className="flex items-center gap-2 bg-muted/30 border border-border/60 rounded-lg px-3 py-2">
                <span className="text-sm">{INTEGRATION_ICONS[key] ?? "🔗"}</span>
                <span className="text-xs text-foreground/80">{INTEGRATION_LABELS[key] ?? key}</span>
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No integrations yet. Ask the AI to connect your apps!</p>
        )}
      </div>

      {/* Activity feed */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">Activity Feed</p>
        {activity.length > 0 ? (
          <div className="space-y-1.5">
            {activity.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-start gap-2 bg-muted/30 border border-border/60 rounded-lg px-3 py-2">
                <div className={cn("mt-1 w-1 h-1 rounded-full shrink-0", e.success ? "bg-emerald-500" : "bg-destructive")} />
                <div className="min-w-0">
                  <p className="text-xs text-foreground/80 truncate">{e.message}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(e.timestamp)} · {e.trigger}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No activity yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({ sessions }: { sessions: ChatSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No conversations yet</p>
        <Link href="/dashboard" className="text-xs text-primary hover:underline mt-1 block">
          Start a conversation →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href="/dashboard"
          className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-xs text-foreground/80 truncate group-hover:text-foreground">{s.title}</p>
            <p className="text-[10px] text-muted-foreground">{s.messages.length} messages</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px] ml-2">{formatDate(s.createdAt)}</Badge>
        </Link>
      ))}
    </div>
  );
}

// ─── Tab: Keys ────────────────────────────────────────────────────────────────

function KeysTab({ config }: { config: SerializedConfig }) {
  return (
    <div className="space-y-1.5">
      {KEY_SLOTS.map(({ service, field, label, icon }) => {
        const val = config[field as keyof SerializedConfig] as string;
        const isSet = !!val;
        return (
          <div key={field} className="flex items-center gap-3 bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5">
            <span className="text-base shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground/90">{service}</p>
              <p className="text-[10px] text-muted-foreground">
                {isSet ? maskValue(val) : label}
              </p>
            </div>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
              isSet ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
            )}>
              {isSet ? "Connected" : "Not set"}
            </span>
          </div>
        );
      })}
      <div className="pt-2 text-center">
        <Link href="/settings" className="text-xs text-primary hover:underline">
          Configure in Settings →
        </Link>
      </div>
    </div>
  );
}

// ─── Tab: Jobs ────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  name: string;
  mission: string;
  integrations: string[];
  autoRun: boolean;
  intervalMinutes: number;
  lastRunAt?: string;
  lastResult?: "success" | "failed";
  lastMessage?: string;
  createdAt: string;
}

const INTERVAL_OPTIONS = [
  { label: "5m",  value: 5 },
  { label: "10m", value: 10 },
  { label: "30m", value: 30 },
  { label: "1h",  value: 60 },
  { label: "6h",  value: 360 },
  { label: "24h", value: 1440 },
];

function timeAgo(ts?: string): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function JobsTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const runJob = async (id: string) => {
    setRunning((r) => ({ ...r, [id]: true }));
    try {
      const res = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
      const data = await res.json();
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, lastRunAt: new Date().toISOString(), lastResult: data.success ? "success" : "failed", lastMessage: data.message }
            : j
        )
      );
    } finally {
      setRunning((r) => ({ ...r, [id]: false }));
    }
  };

  const patch = async (id: string, update: Partial<Job>) => {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const updated = await res.json();
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  };

  const removeJob = async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <p className="text-xs text-muted-foreground">No jobs yet</p>
        <Link href="/dashboard" className="text-xs text-primary hover:underline block">
          Brief your first agent →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const isRunning = running[job.id];
        return (
          <div key={job.id} className="bg-muted/30 border border-border/60 rounded-xl p-3 space-y-2">
            {/* Name + status dot */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{job.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {job.autoRun && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                  <p className="text-[10px] text-muted-foreground truncate">
                    {job.lastRunAt
                      ? <>Last run {timeAgo(job.lastRunAt)} {job.lastResult === "success" ? "✓" : "✗"}</>
                      : "Never run"}
                  </p>
                </div>
              </div>
            </div>

            {/* Integrations */}
            {job.integrations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {job.integrations.map((i) => (
                  <span key={i} className="text-[9px] bg-muted border border-border/50 text-muted-foreground px-1.5 py-0.5 rounded">
                    {INTEGRATION_LABELS[i] ?? i}
                  </span>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              {/* Run once */}
              <Button
                size="xs"
                variant="outline"
                onClick={() => runJob(job.id)}
                disabled={isRunning}
                className="gap-1 h-6 px-2 text-[10px]"
              >
                {isRunning
                  ? <Loader2 className="size-2.5 animate-spin" />
                  : <Play className="size-2.5" />}
                Run
              </Button>

              {/* Auto toggle */}
              {job.autoRun ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => patch(job.id, { autoRun: false })}
                  className="gap-1 h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Square className="size-2.5" /> Stop
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => patch(job.id, { autoRun: true })}
                  className="gap-1 h-6 px-2 text-[10px]"
                >
                  <Zap className="size-2.5" /> Auto
                </Button>
              )}

              {/* Interval picker */}
              <select
                value={job.intervalMinutes}
                onChange={(e) => patch(job.id, { intervalMinutes: Number(e.target.value) })}
                className="h-6 rounded-md border border-border bg-transparent text-[10px] text-muted-foreground px-1 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Delete */}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => removeJob(job.id)}
                className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Logs ────────────────────────────────────────────────────────────────

function LogsTab({ activity }: { activity: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (activity.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No logs yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Run a job or set up a webhook</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((e) => {
        const isOpen = !!expanded[e.id];
        return (
          <div key={e.id} className="border border-border/60 rounded-lg overflow-hidden">
            {/* Collapsed row — always visible */}
            <button
              onClick={() => setExpanded((s) => ({ ...s, [e.id]: !s[e.id] }))}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", e.success ? "bg-emerald-500" : "bg-destructive")} />
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{formatTime(e.timestamp)}</span>
              <span className="text-xs text-foreground/80 truncate flex-1">{e.message}</span>
              <ChevronDown className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180")} />
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="px-3 pb-3 pt-1 bg-muted/20 border-t border-border/40 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] font-mono h-4">{e.trigger}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatDate(e.timestamp)} {formatTime(e.timestamp)}</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{e.message}</p>
                {e.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {e.actions.map((a, i) => (
                      <span key={i} className="text-[9px] font-mono border border-border/50 text-muted-foreground px-1.5 py-0.5 rounded">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
