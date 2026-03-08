import { NextResponse } from "next/server";

export const maxDuration = 60;
import { readJobs } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";

// Called by Vercel Cron on a schedule (see vercel.json).
// Also used by instrumentation.ts locally via node-cron.
export async function GET(req: Request) {
  // Verify request is from Vercel's cron system (only enforced if CRON_SECRET is set)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const jobs = await readJobs();
  const now = Date.now();
  const triggered: string[] = [];

  for (const job of jobs) {
    if (!job.autoRun) continue;
    if (!job.intervalMinutes || job.intervalMinutes <= 0) continue;

    const intervalMs = job.intervalMinutes * 60 * 1000;
    const lastRun = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0;

    if (now - lastRun >= intervalMs) {
      console.log(`[cron] Running job: ${job.name}`);
      // Fire and forget — don't await all jobs serially to avoid timeout
      runJob(job).catch((err) =>
        console.error(`[cron] Job "${job.name}" failed:`, err)
      );
      triggered.push(job.name);
    }
  }

  return NextResponse.json({ triggered, count: triggered.length });
}
