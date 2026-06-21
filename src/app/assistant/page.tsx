"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import SpotCard from "@/components/SpotCard";
import { SparkleIcon } from "@/components/icons";
import { useStore } from "@/lib/store";
import { getRestaurant } from "@/lib/data";
import { resolveNearbyNeighborhood } from "@/lib/neighborhoods";
import { parseQuery } from "@/lib/recommend";
import { useScrollRestoration } from "@/lib/useScrollRestoration";
import { track } from "@/lib/analytics";

const SUGGESTIONS = [
  "Find me a hidden gem for dinner tonight",
  "An underground spot to impress a date",
  "Hole-in-the-wall, spicy, cash is fine",
  "What should I order at …?",
];

// Bold the **name** segments of a single line. Restaurant/dish names never
// contain "*", so a simple split is enough — this is not a general Markdown
// parser, just the two things our replies use (bold + line breaks).
function renderBold(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {seg.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

// Render an assistant reply as the scannable list it's written as: blank lines
// become paragraphs, single newlines become line breaks, and **name** is bolded.
// Plain one-line replies (small talk, errors) render unchanged.
function FormattedReply({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((block, bi) => (
        <p key={bi} className={bi > 0 ? "mt-2" : undefined}>
          {block.split("\n").map((line, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {renderBold(line)}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

export default function AssistantPage() {
  const profile = useStore((s) => s.profile);
  // Conversation lives in the store so it survives navigating into a restaurant
  // and back (in-memory only — a fresh app open starts empty).
  const messages = useStore((s) => s.assistantMessages);
  const setMessages = useStore((s) => s.setAssistantMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useScrollRestoration<HTMLDivElement>("assistant");

  const send = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setInput("");
    // Bounded conversation context: the recent prior turns (before this new one),
    // trimmed to role+text. The server is stateless and re-clamps this; sending
    // it lets follow-ups refine instead of resetting.
    const history = messages
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: query }]);
    setLoading(true);
    track("assistant_query", { length: query.length });
    try {
      // For "near me" queries, resolve the user's neighborhood so the API can
      // steer toward it. Fail-silent (null) if denied/unavailable.
      const nearNeighborhood = parseQuery(query).nearMe
        ? await resolveNearbyNeighborhood()
        : null;
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, profile, nearNeighborhood, history, userTime: Date.now() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              res.status === 429
                ? data?.reply ??
                  "I'm fielding a lot of requests right now — give it a few seconds and try again."
                : "Something went wrong on my end — try again in a moment.",
          },
        ]);
        return;
      }
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
        {
          role: "assistant",
          text: "I couldn't reach the server — check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  };

  // Deep-link from search: /assistant?q=... auto-asks the question once on load.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    const q =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("q")
        : null;
    if (q && q.trim()) {
      didInit.current = true;
      send(q);
      // Strip ?q so returning here (e.g. back from a restaurant) doesn't re-ask.
      window.history.replaceState(null, "", "/assistant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="flex h-full flex-col bg-paper pb-[calc(68px_+_env(safe-area-inset-bottom))]">
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3.5">
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

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-5"
        >
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
                    <FormattedReply text={m.text} />
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
            <div
              role="status"
              aria-live="polite"
              aria-label="Finding spots for you"
              className="flex items-center gap-1.5 text-ink-faint"
            >
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
          className="shrink-0 border-t border-line bg-paper/90 p-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 rounded-full bg-paper-raised px-4 py-2 ring-1 ring-line">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() =>
                // Let the on-screen keyboard animate in, then bring the latest
                // content (and this input) above it.
                setTimeout(
                  () =>
                    endRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "end",
                    }),
                  300,
                )
              }
              placeholder="What are you in the mood for?"
              aria-label="Describe what you're craving"
              enterKeyHint="send"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
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
