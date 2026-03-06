"use client";

import { useState } from "react";

export default function RunNowButton() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  const run = async () => {
    setState("running");
    await fetch("/api/run", { method: "POST" });
    setState("done");
    setTimeout(() => setState("idle"), 3000);
  };

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className="flex items-center gap-2 bg-zinc-100 text-zinc-900 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      {state === "running" && (
        <span className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
      )}
      {state === "done" ? "✓ Done" : state === "running" ? "Running..." : "Run Now"}
    </button>
  );
}
