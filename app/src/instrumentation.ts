export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readJobs } = await import("./lib/jobs");
    const { runJob } = await import("./lib/run-job");
    const cron = await import("node-cron");

    // Single tick every minute — checks which jobs are due
    cron.schedule("* * * * *", async () => {
      const jobs = readJobs();
      const now = Date.now();

      for (const job of jobs) {
        if (!job.autoRun) continue;

        const intervalMs = job.intervalMinutes * 60 * 1000;
        const lastRun = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0;

        if (now - lastRun >= intervalMs) {
          console.log(`[MCP Agent] Running job: ${job.name}`);
          await runJob(job);
        }
      }
    });

    console.log("[MCP Agent] Job scheduler started — checking every minute");
  }
}
