import { NextRequest, NextResponse } from "next/server";
import { patchJob, deleteJob } from "@/lib/jobs";
import { auth } from "@/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await auth();
  const { id } = await params;
  const body = await req.json();
  const updated = patchJob(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await auth();
  const { id } = await params;
  const ok = deleteJob(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
