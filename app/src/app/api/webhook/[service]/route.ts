import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  let body: unknown = null;

  try {
    body = await req.json();
  } catch {
    // body might be empty
  }

  // Build a context string from the webhook payload
  const context = body
    ? `Webhook payload from ${service}:\n${JSON.stringify(body, null, 2).slice(0, 2000)}`
    : `Webhook received from ${service} with no payload.`;

  const result = await runAgent(`webhook:${service}`, context);

  return NextResponse.json(result);
}

// Allow GET for simple ping verification (e.g. GitHub webhook setup)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  return NextResponse.json({ ok: true, message: `MCP Operator webhook ready for ${service}` });
}
