import { NextResponse } from "next/server";
import { readActivity } from "@/lib/activity";

export async function GET() {
  const entries = readActivity(20);
  return NextResponse.json(entries);
}
