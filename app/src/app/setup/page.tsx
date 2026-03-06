"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Message =
  | { role: "agent"; text: string }
  | { role: "user"; text: string }
  | { role: "tool"; ok: boolean; text: string };

interface ApiToolResult {
  tool: string;
  ok: boolean;
  message: string;
  redirect?: string;
}

function toApiMessages(messages: Message[]) {
  return messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));
}

export default function SetupPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      text: "Hey! I'm MCP Operator — an autonomous agent you brief once and it runs forever.\n\nWhat do you want to automate? Just describe it naturally.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", text: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(updatedMessages) }),
      });

      const data = await res.json();
      const newMessages: Message[] = [];

      // Inject tool result cards before the agent reply
      if (data.toolResults?.length) {
        data.toolResults.forEach((tr: ApiToolResult) => {
          newMessages.push({ role: "tool", ok: tr.ok, text: tr.message });
        });
      }

      if (data.reply) {
        newMessages.push({ role: "agent", text: data.reply });
      }

      setMessages((prev) => [...prev, ...newMessages]);

      if (data.redirectTo) {
        setTimeout(() => router.push(data.redirectTo), 2000);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">
            MCP Operator
          </span>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            Setup
          </span>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((msg, i) => {
            if (msg.role === "tool") {
              return (
                <div key={i} className="flex justify-start">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border ${
                      msg.ok
                        ? "bg-emerald-950/60 border-emerald-800/50 text-emerald-300"
                        : "bg-red-950/60 border-red-800/50 text-red-300"
                    }`}
                  >
                    <span className="text-sm">{msg.ok ? "✓" : "✗"}</span>
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-zinc-700 text-zinc-100 rounded-br-sm"
                      : "bg-zinc-800/80 text-zinc-200 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "agent" && (
                    <p className="text-[10px] font-medium text-zinc-500 mb-1 uppercase tracking-widest">
                      Operator
                    </p>
                  )}
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800/80 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800/60 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to automate..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="shrink-0 bg-zinc-100 text-zinc-900 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
