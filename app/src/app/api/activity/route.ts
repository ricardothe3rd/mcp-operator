import { NextResponse } from "next/server";
import { readActivity } from "@/lib/activity";

// Auth is enforced by middleware — no additional check needed here
export async function GET() {
  const entries = readActivity(20);
  return NextResponse.json(entries);
}
