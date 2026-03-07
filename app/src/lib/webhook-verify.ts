import crypto from "crypto";

/** GitHub: X-Hub-Signature-256 header, HMAC-SHA256 of raw body */
export async function verifyGitHubSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, signature);
}

/** Slack: X-Slack-Signature + X-Slack-Request-Timestamp, with 5-min replay guard */
export async function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > 300) return false; // reject replays older than 5 minutes

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + crypto.createHmac("sha256", secret).update(sigBase).digest("hex");
  return timingSafeEqual(expected, signature);
}

/** Simple bearer-token check for generic / unknown services */
export function verifyBearerToken(authHeader: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false; // secret not configured = deny
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return timingSafeEqual(secret, token);
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
