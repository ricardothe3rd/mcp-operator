import { supabase } from "./supabase";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  trigger: string;
  actions: string[];
  success: boolean;
  message: string;
  jobId?: string;
}

export async function readActivityByJob(jobId: string, limit = 5): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from("activity")
    .select("*")
    .eq("job_id", jobId)
    .order("timestamp", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toEntry);
}

export async function readActivity(limit = 20): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from("activity")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toEntry);
}

export async function appendActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">
): Promise<void> {
  await supabase.from("activity").insert({
    trigger: entry.trigger,
    actions: entry.actions,
    success: entry.success,
    message: entry.message,
    job_id: entry.jobId ?? null,
  });
}

function toEntry(row: Record<string, unknown>): ActivityEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    trigger: row.trigger as string,
    actions: row.actions as string[],
    success: row.success as boolean,
    message: row.message as string,
    jobId: row.job_id as string | undefined,
  };
}
