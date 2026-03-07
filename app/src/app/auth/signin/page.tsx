"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Zap, MessageSquare, Plug, Clock, Eye, EyeOff, Loader2 } from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">

      {/* Left panel */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight text-foreground">MCP Operator</span>
        </div>

        <div className="relative space-y-10">
          <div>
            <blockquote className="text-3xl font-bold tracking-tight leading-snug text-foreground mb-3">
              &ldquo;Brief it once.<br />It runs forever.&rdquo;
            </blockquote>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Connect your tools in minutes. Your agent handles the rest.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: <MessageSquare className="size-4" />, text: "Describe what to automate in plain chat" },
              { icon: <Plug className="size-4" />, text: "Connect Discord, Slack, GitHub, Notion & more" },
              { icon: <Clock className="size-4" />, text: "Runs on schedule, logs everything it does" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center shrink-0 text-foreground">
                  {icon}
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 border border-border bg-muted/50 text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Now in beta — brief your first agent free
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">MCP Operator</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "signin" ? "Sign in to your account to continue" : "Start briefing your agent in minutes"}
            </p>
          </div>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all mb-5"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all mt-1"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-sm text-muted-foreground text-center mt-5">
            {mode === "signin" ? (
              <>Don&apos;t have an account?{" "}
                <button onClick={() => { setMode("register"); setError(""); }} className="text-foreground hover:underline font-medium">
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("signin"); setError(""); }} className="text-foreground hover:underline font-medium">
                  Sign in
                </button>
              </>
            )}
          </p>

          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            By signing in, you agree to our terms of service.
          </p>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
