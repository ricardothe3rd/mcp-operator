export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readConfig } = await import("./lib/config");
    const { runAgent } = await import("./lib/agent");
    const cron = await import("node-cron");

    const config = readConfig();
    const interval = config.cronIntervalMinutes || 5;
    const mission = config.agentMission || "perform a scheduled check-in";

    console.log(
      `[MCP Operator] Cron scheduler starting — every ${interval} minutes`
    );
    console.log(`[MCP Operator] Mission: ${mission}`);

    cron.schedule(`*/${interval} * * * *`, async () => {
      console.log(`[MCP Operator] Scheduled check-in triggered`);
      await runAgent("scheduled-checkin", `Perform a regular check-in. Mission: ${mission}`);
    });
  }
}
