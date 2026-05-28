"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Message type — matches the LLM service Message format.
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
};

/**
 * AI Chat Box — themed for InvoiceStudio dark UI.
 *
 * Usage:
 * ```tsx
 * const [messages, setMessages] = useState<Message[]>([]);
 * const [loading, setLoading] = useState(false);
 *
 * async function handleSend(content: string) {
 *   const next = [...messages, { role: "user" as const, content }];
 *   setMessages(next);
 *   setLoading(true);
 *   const res = await fetch("/api/ai/suggest", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ messages: next }),
 *   });
 *   const json = await res.json();
 *   setMessages([...next, { role: "assistant" as const, content: json.text ?? "" }]);
 *   setLoading(false);
 * }
 *
 * return <AIChatBox messages={messages} onSendMessage={handleSend} isLoading={loading} />;
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Scrivi un messaggio...",
  className,
  height = "600px",
  emptyStateMessage = "Inizia una conversazione con l'AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayMessages = messages.filter((m) => m.role !== "system");

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [displayMessages.length, isLoading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-[#111318] text-[#f0f0f2] rounded-xl border border-[#1e2029] shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-[#6b7280]">
            <div className="flex flex-col items-center gap-3">
              <div className="text-5xl opacity-40">✦</div>
              <p className="text-sm text-center">{emptyStateMessage}</p>
            </div>

            {suggestedPrompts && suggestedPrompts.length > 0 && (
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(prompt)}
                    disabled={isLoading}
                    className="rounded-lg border border-[#1e2029] bg-[#0d0e13] px-3 py-1.5 text-xs text-[#9ca3af] cursor-pointer transition-colors hover:bg-[#1a1c23] hover:text-[#e5e7eb] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {displayMessages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end items-start" : "justify-start items-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-[#6c63ff]/15 flex items-center justify-center text-[#6c63ff]">
                    ✦
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                    message.role === "user"
                      ? "bg-[#6c63ff] text-white"
                      : "bg-[#0d0e13] text-[#e5e7eb] border border-[#1e2029]"
                  )}
                >
                  {message.content}
                </div>

                {message.role === "user" && (
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-[#1e2029] flex items-center justify-center text-[#9ca3af]">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start items-start">
                <div className="size-8 shrink-0 mt-1 rounded-full bg-[#6c63ff]/15 flex items-center justify-center text-[#6c63ff]">
                  ✦
                </div>
                <div className="bg-[#0d0e13] border border-[#1e2029] rounded-2xl px-4 py-2.5 text-sm text-[#6b7280] flex gap-1.5">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#1e2029] p-3 flex gap-2 items-end"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-[#0d0e13] border border-[#1e2029] rounded-lg px-3 py-2 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] resize-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 rounded-lg bg-[#6c63ff] hover:bg-[#5b52e0] text-white text-sm font-medium border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? "..." : "Invia"}
        </button>
      </form>
    </div>
  );
}

export default AIChatBox;
