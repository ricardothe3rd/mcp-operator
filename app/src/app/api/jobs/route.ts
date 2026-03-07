import { NextRequest, NextResponse } from "next/server";
import { readJobs, createJob } from "@/lib/jobs";
import { auth } from "@/auth";

export async function GET() {
  await auth();
  return NextResponse.json(readJobs());
}

export async function POST(req: NextRequest) {
  await auth();
  const body = await req.json();
  const job = createJob({
    name: body.name ?? "New Job",
    mission: body.mission ?? "",
    integrations: body.integrations ?? [],
    autoRun: false,
    intervalMinutes: body.intervalMinutes ?? 10,
  });
  return NextResponse.json(job, { status: 201 });
}
