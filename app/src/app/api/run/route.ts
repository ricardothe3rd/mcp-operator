import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export async function POST() {
  const result = await runAgent("manual-trigger", "User triggered a manual run from the dashboard.");
  return NextResponse.json(result);
}
