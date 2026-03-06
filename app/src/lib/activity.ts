import fs from "fs";
import path from "path";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  trigger: string;
  actions: string[];
  success: boolean;
  message: string;
}

const ACTIVITY_PATH = path.join(process.cwd(), "mcp-operator.activity.json");
const MAX_ENTRIES = 50;

export function readActivity(limit = 20): ActivityEntry[] {
  try {
    if (!fs.existsSync(ACTIVITY_PATH)) return [];
    const raw = fs.readFileSync(ACTIVITY_PATH, "utf-8");
    const entries: ActivityEntry[] = JSON.parse(raw);
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

export async function appendActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">
): Promise<void> {
  const existing = readActivity(MAX_ENTRIES);
  const newEntry: ActivityEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);
  fs.writeFileSync(ACTIVITY_PATH, JSON.stringify(updated, null, 2));
}
