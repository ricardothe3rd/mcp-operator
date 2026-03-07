import { NextRequest, NextResponse } from "next/server";
import { readJobs } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  const key = `run:${session?.user?.email ?? "anon"}`;
  const { ok, retryAfter } = checkRateLimit(key, 10, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const jobs = readJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runJob(job);
  return NextResponse.json(result);
}
