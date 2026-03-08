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
  job: Job,
  triggerContext?: string
): Promise<{ success: boolean; message: string }> {
  // ── 1. Build history context ──────────────────────────────────────────────
  const recentRuns = await readActivityByJob(job.id, 5);

  let historyContext = "";
  if (recentRuns.length > 0) {
    historyContext =
      "\n\nRecent run history (tool calls only):\n" +
      recentRuns
        .map((e) => {
          // Only show tool calls made — skip the final text summary to avoid feedback loops
          const toolCalls = e.actions.filter((a) => a.startsWith("Called "));
          const status = e.success ? "✓" : "✗";
          const calls = toolCalls.length > 0 ? toolCalls.join(", ") : "no tool calls";
          return `[${new Date(e.timestamp).toLocaleString()}] ${status} ${calls}`;
        })
        .join("\n") +
      "\n\nIf previous runs show 'no tool calls', that means tools failed to load — they are now loaded and ready. Use them.";
  }

  const context = triggerContext
    ? `${triggerContext}\n\nJob: ${job.name}\nMission: ${job.mission}${historyContext}`
    : `Job: ${job.name}\nMission: ${job.mission}${historyContext}`;

  // ── 2. Run the agent ──────────────────────────────────────────────────────
  const result = await runAgent("scheduled", context, job.id, job.mission, job.integrations);

  // ── 3. Update job stats ───────────────────────────────────────────────────
  const consecutiveFailures = result.success
    ? 0
    : (job.consecutiveFailures ?? 0) + 1;

  await patchJob(job.id, {
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
