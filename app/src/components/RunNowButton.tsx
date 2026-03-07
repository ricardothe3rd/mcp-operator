"use client";

import { useState } from "react";
import { Loader2, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RunNowButton() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  const run = async () => {
    setState("running");
    await fetch("/api/run", { method: "POST" });
    setState("done");
    setTimeout(() => setState("idle"), 3000);
  };

  return (
    <Button onClick={run} disabled={state === "running"} size="sm">
      {state === "running" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-3.5" />
      ) : (
        <Zap className="size-3.5" />
      )}
      {state === "done" ? "Done" : state === "running" ? "Running…" : "Run Now"}
    </Button>
  );
}
