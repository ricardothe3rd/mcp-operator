"use client";

import Link from "next/link";
import { Zap, MessageSquare, Plug, Clock } from "lucide-react";
import SignInButton from "@/components/SignInButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Zap className="size-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">MCP Operator</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <SignInButton
              className={cn(buttonVariants({ size: "sm" }))}
              callbackUrl="/dashboard"
            >
              Sign In →
            </SignInButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 py-32 text-center">
          {/* Beta badge */}
          <div className="inline-flex items-center gap-2 border border-border bg-muted/50 text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Now in beta — brief your first agent free
          </div>

          <h1 className="text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-foreground">
            An agent you brief,
            <br />
            <span className="text-muted-foreground">
              not a workflow you build.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            Describe what to automate. It connects your tools and runs —
            on its own, forever.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard" className={cn(buttonVariants({ size: "default" }), "px-6 py-5 text-sm font-semibold")}>
              Start briefing →
            </Link>
            <SignInButton
              className={cn(buttonVariants({ variant: "outline", size: "default" }), "px-6 py-5 text-sm")}
              callbackUrl="/dashboard"
            >
              Go to dashboard
            </SignInButton>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-6">
            No credit card required · Takes 2 minutes to set up
          </p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={<MessageSquare className="size-5" />}
            title="Brief in plain chat"
            description="Describe what you want automated. No workflow builders, drag-and-drop, or YAML files."
          />
          <FeatureCard
            icon={<Plug className="size-5" />}
            title="Connects your tools"
            description="Discord, Slack, GitHub, Notion, Airtable, and more — live in minutes with a single credential."
          />
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="Runs automatically"
            description="Your agent runs on a cron schedule, acts on your behalf, and logs everything it does."
          />
        </div>
      </section>

    </div>
  );
}

function FeatureCard({
  icon, title, description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl px-6 py-6 hover:border-border/80 hover:-translate-y-0.5 transition-all">
      <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
