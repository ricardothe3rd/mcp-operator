import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Use query params if provided (before saving), otherwise fall back to saved config
  const config = readConfig();
  const apiKey = searchParams.get("apiKey") || config.airtableApiKey;
  const baseId = searchParams.get("baseId") || config.airtableBaseId;

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: "API key and Base ID required" }, { status: 400 });
  }

  // Strip masked placeholder values
  if (apiKey.startsWith("••••") || baseId.startsWith("••••")) {
    return NextResponse.json({ error: "Save your API key and Base ID first" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message || `Airtable returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const tables = (data.tables as { id: string; name: string }[]).map((t) => ({
      id: t.id,
      name: t.name,
    }));

    return NextResponse.json({ tables });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tables" },
      { status: 500 }
    );
  }
}
