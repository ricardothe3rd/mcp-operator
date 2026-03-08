import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { readJobs } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  verifyGitHubSignature,
  verifySlackSignature,
  verifyBearerToken,
} from "@/lib/webhook-verify";

// Only accept webhooks from known services
const ALLOWED_SERVICES = new Set([
  "github", "slack", "discord", "stripe", "airtable", "notion",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  const normalised = service.toLowerCase();

  // Reject unknown services
  if (!ALLOWED_SERVICES.has(normalised)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  // Rate limit: 20 webhooks per minute per service
  const { ok: rateOk, retryAfter } = checkRateLimit(`webhook:${normalised}`, 20, 60_000);
  if (!rateOk) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Read raw body for signature verification (must be before any .json() call)
  const rawBody = await req.text();

  // ── Signature verification ──────────────────────────────────────────────────
  const verified = await verifyWebhook(normalised, req.headers, rawBody);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // non-JSON body is fine
  }

  // Sanitise context — limit size, strip any null bytes
  const payloadStr = rawBody
    ? JSON.stringify(body ?? rawBody, null, 2)
        .slice(0, 2000)
        .replace(/\0/g, "")
    : "";
  const context = payloadStr
    ? `Webhook payload from ${normalised}:\n${payloadStr}`
    : `Webhook received from ${normalised} with no payload.`;

  // Find jobs that include this service and run them with the webhook payload
  const matchingJobs = readJobs().filter((j) => j.integrations.includes(normalised));

  if (matchingJobs.length > 0) {
    const results = await Promise.allSettled(
      matchingJobs.map((job) => runJob(job, context))
    );
    return NextResponse.json({
      ok: true,
      jobsTriggered: matchingJobs.map((j) => j.name),
      results: results.map((r) => (r.status === "fulfilled" ? r.value : { success: false, message: String(r.reason) })),
    });
  }

  // Fallback: no matching jobs — run agent globally
  const result = await runAgent(`webhook:${normalised}`, context);
  return NextResponse.json(result);
}

// GET ping for webhook URL verification (e.g. GitHub)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  if (!ALLOWED_SERVICES.has(service.toLowerCase())) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: `MCP Operator webhook ready for ${service}` });
}

// ── Verification helpers ──────────────────────────────────────────────────────

async function verifyWebhook(
  service: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  switch (service) {
    case "github": {
      const secret = process.env.GITHUB_WEBHOOK_SECRET;
      const sig = headers.get("x-hub-signature-256");
      if (!secret || !sig) return !!process.env.WEBHOOK_SECRET_BYPASS; // dev mode
      return verifyGitHubSignature(rawBody, sig, secret);
    }

    case "slack": {
      const secret = process.env.SLACK_SIGNING_SECRET;
      const ts = headers.get("x-slack-request-timestamp");
      const sig = headers.get("x-slack-signature");
      if (!secret || !ts || !sig) return !!process.env.WEBHOOK_SECRET_BYPASS;
      return verifySlackSignature(rawBody, ts, sig, secret);
    }

    default:
      // All other services: require a bearer token
      return verifyBearerToken(headers.get("authorization"));
  }
}
