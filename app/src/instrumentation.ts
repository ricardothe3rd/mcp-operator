export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readJobs } = await import("./lib/jobs");
    const { runJob } = await import("./lib/run-job");
    const cron = await import("node-cron");

    // Single tick every minute — checks which jobs are due
    cron.schedule("* * * * *", async () => {
      const jobs = await readJobs();
      const now = Date.now();

      for (const job of jobs) {
        if (!job.autoRun) continue;
        // intervalMinutes: 0 means webhook-triggered only — skip in scheduler
        if (!job.intervalMinutes || job.intervalMinutes <= 0) continue;

        const intervalMs = job.intervalMinutes * 60 * 1000;
        const lastRun = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0;

        if (now - lastRun >= intervalMs) {
          console.log(`[MCP Operator] Running job: ${job.name}`);
          await runJob(job);
        }
      }
    });

    console.log("[MCP Operator] Job scheduler started — checking every minute");
  }
}
