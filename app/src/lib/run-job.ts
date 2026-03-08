import { runAgent } from "./agent";
import { readActivityByJob } from "./activity";
import { patchJob, type Job } from "./jobs";
import { sendAlert } from "./alerts";

const FAILURE_ALERT_THRESHOLD = 3;

/**
 * Runs a job with full feedback loop:
 *  1. Builds context from the job's recent run history so the agent
 *     can see what it previously did and self-correct.
 *  2. Calls the agent.
 *  3. Updates the job record (lastRunAt, lastResult, consecutiveFailures).
 *  4. Sends a Discord/Slack alert if the job has failed repeatedly.
 */
export async function runJob(
  job: Job
): Promise<{ success: boolean; message: string }> {
  // ── 1. Build history context ──────────────────────────────────────────────
  const recentRuns = readActivityByJob(job.id, 5);

  let historyContext = "";
  if (recentRuns.length > 0) {
    historyContext =
      "\n\nYour recent run history for this job:\n" +
      recentRuns
        .map(
          (e) =>
            `[${new Date(e.timestamp).toLocaleString()}] ${e.success ? "✓" : "✗"} ${e.message}`
        )
        .join("\n") +
      "\n\nUse this history to avoid repeating mistakes and build on previous successes.";
  }

  const context = `Job: ${job.name}\nMission: ${job.mission}${historyContext}`;

  // ── 2. Run the agent ──────────────────────────────────────────────────────
  const result = await runAgent("scheduled", context, job.id, job.mission, job.integrations);

  // ── 3. Update job stats ───────────────────────────────────────────────────
  const consecutiveFailures = result.success
    ? 0
    : (job.consecutiveFailures ?? 0) + 1;

  patchJob(job.id, {
    lastRunAt: new Date().toISOString(),
    lastResult: result.success ? "success" : "failed",
    lastMessage: result.message,
    consecutiveFailures,
  });

  // ── 4. Alert on repeated failures ────────────────────────────────────────
  if (!result.success && consecutiveFailures >= FAILURE_ALERT_THRESHOLD) {
    await sendAlert(
      `⚠️ MCP Operator — Job "${job.name}" has failed ${consecutiveFailures} times in a row.\n\nLast error: ${result.message}\n\nCheck your Jobs tab to review or stop this job.`
    );
  }

  return { success: result.success, message: result.message };
}
