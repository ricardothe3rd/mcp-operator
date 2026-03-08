import { supabase } from "./supabase";

export interface Job {
  id: string;
  name: string;
  mission: string;
  integrations: string[];
  autoRun: boolean;
  intervalMinutes: number;
  lastRunAt?: string;
  lastResult?: "success" | "failed";
  lastMessage?: string;
  consecutiveFailures: number;
  createdAt: string;
}

export async function readJobs(): Promise<Job[]> {
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(toJob);
}

export async function getJob(id: string): Promise<Job | null> {
  const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
  return data ? toJob(data) : null;
}

export async function createJob(
  data: Omit<Job, "id" | "createdAt" | "consecutiveFailures">
): Promise<Job> {
  const id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const { data: row, error } = await supabase
    .from("jobs")
    .insert({
      id,
      name: data.name,
      mission: data.mission,
      integrations: data.integrations,
      auto_run: data.autoRun,
      interval_minutes: data.intervalMinutes,
      consecutive_failures: 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toJob(row);
}

export async function patchJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.mission !== undefined) update.mission = patch.mission;
  if (patch.integrations !== undefined) update.integrations = patch.integrations;
  if (patch.autoRun !== undefined) update.auto_run = patch.autoRun;
  if (patch.intervalMinutes !== undefined) update.interval_minutes = patch.intervalMinutes;
  if (patch.lastRunAt !== undefined) update.last_run_at = patch.lastRunAt;
  if (patch.lastResult !== undefined) update.last_result = patch.lastResult;
  if (patch.lastMessage !== undefined) update.last_message = patch.lastMessage;
  if (patch.consecutiveFailures !== undefined) update.consecutive_failures = patch.consecutiveFailures;

  const { data, error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return toJob(data);
}

export async function deleteJob(id: string): Promise<boolean> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  return !error;
}

function toJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    name: row.name as string,
    mission: row.mission as string,
    integrations: (row.integrations as string[]) ?? [],
    autoRun: row.auto_run as boolean,
    intervalMinutes: row.interval_minutes as number,
    lastRunAt: row.last_run_at as string | undefined,
    lastResult: row.last_result as "success" | "failed" | undefined,
    lastMessage: row.last_message as string | undefined,
    consecutiveFailures: (row.consecutive_failures as number) ?? 0,
    createdAt: row.created_at as string,
  };
}
