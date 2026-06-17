"use client";

import { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import SpotCard from "@/components/SpotCard";
import { SparkleIcon } from "@/components/icons";
import { useStore } from "@/lib/store";
import { getRestaurant } from "@/lib/data";

interface Msg {
  role: "user" | "assistant";
  text: string;
  restaurantIds?: string[];
  engine?: string;
}

const SUGGESTIONS = [
  "Find me a hidden gem for dinner tonight",
  "An underground spot to impress a date",
  "Hole-in-the-wall, spicy, cash is fine",
  "What should I order at …?",
];

export default function AssistantPage() {
  const profile = useStore((s) => s.profile);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: query }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, profile }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply ?? "Here are some ideas.",
          restaurantIds: data.restaurantIds ?? [],
          engine: data.engine,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Something went wrong — try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col bg-paper">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-olive/15 text-olive">
            <SparkleIcon filled width={20} height={20} />
          </span>
          <div>
            <div className="font-display text-base font-semibold leading-none text-ink">
              Spot Concierge
            </div>
            <div className="text-[11px] text-ink-faint">
              Tell me what you&apos;re craving
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-24">
          {messages.length === 0 && (
            <div className="mt-6">
              <p className="mt-4 text-center text-sm text-ink-soft">
                Tell me what you&apos;re after and I&apos;ll dig up the
                under-the-radar spots that fit your taste — with the insider tip
                to order like a regular.
              </p>
              <div className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-2xl bg-paper-raised px-4 py-3 text-left text-sm text-ink-soft ring-1 ring-line transition hover:bg-olive hover:text-paper active:scale-[0.98]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-olive px-4 py-2.5 text-sm font-medium text-paper">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-paper-raised px-4 py-2.5 text-sm text-ink ring-1 ring-line">
                    {m.text}
                    {m.engine && (
                      <span className="ml-1 align-middle text-[10px] text-ink-faint">
                        · {m.engine === "claude" ? "Claude" : "taste-engine"}
                      </span>
                    )}
                  </div>
                  {m.restaurantIds && m.restaurantIds.length > 0 && (
                    <div className="space-y-2">
                      {m.restaurantIds.map((id) => {
                        const r = getRestaurant(id);
                        if (!r) return null;
                        return <SpotCard key={id} restaurant={r} />;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-1.5 text-ink-faint">
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint" />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="absolute bottom-[68px] inset-x-0 border-t border-line bg-paper/90 p-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 rounded-full bg-paper-raised px-4 py-2 ring-1 ring-line">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What are you in the mood for?"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-olive text-paper disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
