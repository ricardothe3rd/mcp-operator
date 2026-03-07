import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();

  // Rate limit: 10 manual runs per minute per user
  const key = `run:${session?.user?.email ?? "anon"}`;
  const { ok, retryAfter } = checkRateLimit(key, 10, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const result = await runAgent(
    "manual-trigger",
    "User triggered a manual run from the dashboard."
  );
  return NextResponse.json(result);
}
