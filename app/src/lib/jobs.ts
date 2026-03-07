import fs from "fs";
import path from "path";

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

const JOBS_PATH = path.join(process.cwd(), "mcp-operator.jobs.json");

function writeJobs(jobs: Job[]): void {
  fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2), { mode: 0o600 });
}

/** On first run, migrate existing config mission into a default job */
function migrateFromConfig(): Job[] {
  try {
    const { readConfig } = require("./config");
    const config = readConfig();
    if (!config.agentMission) return [];
    const job: Job = {
      id: "job_default",
      name: "Default Agent",
      mission: config.agentMission,
      integrations: config.enabledIntegrations ?? [],
      autoRun: false,
      intervalMinutes: config.cronIntervalMinutes || 10,
      consecutiveFailures: 0,
      createdAt: new Date().toISOString(),
    };
    writeJobs([job]);
    return [job];
  } catch {
    return [];
  }
}

export function readJobs(): Job[] {
  try {
    if (!fs.existsSync(JOBS_PATH)) return migrateFromConfig();
    const raw = fs.readFileSync(JOBS_PATH, "utf-8");
    return JSON.parse(raw) as Job[];
  } catch {
    return [];
  }
}

export function createJob(data: Omit<Job, "id" | "createdAt" | "consecutiveFailures">): Job {
  const job: Job = {
    consecutiveFailures: 0,
    ...data,
    id: "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    createdAt: new Date().toISOString(),
  };
  const jobs = readJobs();
  writeJobs([job, ...jobs]);
  return job;
}

export function patchJob(id: string, patch: Partial<Job>): Job | null {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch };
  writeJobs(jobs);
  return jobs[idx];
}

export function deleteJob(id: string): boolean {
  const jobs = readJobs();
  const filtered = jobs.filter((j) => j.id !== id);
  if (filtered.length === jobs.length) return false;
  writeJobs(filtered);
  return true;
}
