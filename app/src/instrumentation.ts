export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readJobs, patchJob } = await import("./lib/jobs");
    const { runAgent } = await import("./lib/agent");
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
          console.log(`[MCP Operator] Running job: ${job.name}`);
          const result = await runAgent(
            "scheduled",
            `Job: ${job.name}\nMission: ${job.mission}`
          );
          patchJob(job.id, {
            lastRunAt: new Date().toISOString(),
            lastResult: result.success ? "success" : "failed",
            lastMessage: result.message,
          });
        }
      }
    });

    console.log("[MCP Operator] Job scheduler started — checking every minute");
  }
}
