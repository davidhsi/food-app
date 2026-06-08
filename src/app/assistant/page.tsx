"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { SparkleIcon, StarIcon } from "@/components/icons";
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
  "Where do locals actually eat near me?",
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
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/20 text-brand">
            <SparkleIcon filled width={20} height={20} />
          </span>
          <div>
            <div className="text-base font-bold leading-none">Reel Concierge</div>
            <div className="text-[11px] text-white/45">
              Tell me what you&apos;re craving
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-24">
          {messages.length === 0 && (
            <div className="mt-6">
              <div className="text-center text-5xl">🍽️✨</div>
              <p className="mt-4 text-center text-sm text-white/60">
                Tell me what you&apos;re after and I&apos;ll dig up the
                under-the-radar spots that fit your taste — with the insider tip
                to order like a regular.
              </p>
              <div className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm text-white/85 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.98]"
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
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm font-medium">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/8 px-4 py-2.5 text-sm ring-1 ring-white/10">
                    {m.text}
                    {m.engine && (
                      <span className="ml-1 align-middle text-[10px] text-white/30">
                        · {m.engine === "claude" ? "Claude" : "taste-engine"}
                      </span>
                    )}
                  </div>
                  {m.restaurantIds && m.restaurantIds.length > 0 && (
                    <div className="space-y-2">
                      {m.restaurantIds.map((id) => {
                        const r = getRestaurant(id);
                        if (!r) return null;
                        return (
                          <Link
                            key={id}
                            href={`/restaurant/${id}`}
                            className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.99]"
                          >
                            <div
                              className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl"
                              style={{
                                background: `linear-gradient(150deg, ${r.reels[0].gradient[0]}, ${r.reels[0].gradient[1]})`,
                              }}
                            >
                              {r.reels[0].emoji}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold">
                                {r.name}
                              </div>
                              <div className="truncate text-xs text-white/55">
                                {r.cuisines.join(" · ")} · {"$".repeat(r.price)}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-brand-glow">
                                <StarIcon filled width={12} height={12} />
                                {r.rating.toFixed(1)} · {r.neighborhood}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-1.5 text-white/50">
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/50" />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="absolute bottom-[68px] inset-x-0 border-t border-white/10 bg-black/70 p-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/15">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What are you in the mood for?"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
