"use client";

import { useState } from "react";

type Fact = { claim: string; quote: string; verified: boolean };
type Result = {
  url: string | null;
  title: string;
  word_count?: number;
  read_minutes?: number;
  verdict?: "read" | "skim" | "skip";
  reason?: string;
  key_facts?: Fact[];
  verified_count?: number;
  fact_count?: number;
  error?: string;
};

const today = new Date()
  .toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  .toUpperCase();

const badge = {
  read: "bg-ink text-paper",
  skim: "border border-ink",
  skip: "border border-dashed border-muted text-muted",
};

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export default function Page() {
  const [mode, setMode] = useState<"urls" | "text">("urls");
  const [urls, setUrls] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "urls" ? { mode, urls: urls.split("\n") } : { mode, text },
        ),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setResults(data.results);
    } catch {
      setError("The request failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] flex-1 px-4 sm:px-6">
      <header>
        <div className="mt-6 border-y-[3px] border-double border-ink py-4 text-center">
          <h1 className="font-display text-5xl font-black tracking-tight sm:text-6xl">
            SKIMR
          </h1>
        </div>
        <div className="flex flex-col gap-1 py-3 text-[11px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-baseline sm:justify-between">
          <time suppressHydrationWarning>{today}</time>
          <p className="text-ink normal-case tracking-normal sm:text-right">
            Read, skim, or skip. Every claim has a receipt.
          </p>
        </div>
      </header>

      <main>
        <form onSubmit={submit} className="mt-6">
          <div className="flex gap-6 border-b border-ink text-[11px] uppercase tracking-[0.14em]">
            {(["urls", "text"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`-mb-px border-b-2 pb-2 hover:text-ink ${
                  mode === m
                    ? "border-ink text-ink"
                    : "border-transparent text-muted"
                }`}
              >
                {m === "urls" ? "Links" : "Pasted text"}
              </button>
            ))}
          </div>

          <label htmlFor="input" className="sr-only">
            {mode === "urls" ? "Article links, one per line" : "Article text"}
          </label>
          <textarea
            id="input"
            rows={6}
            value={mode === "urls" ? urls : text}
            onChange={(e) =>
              mode === "urls" ? setUrls(e.target.value) : setText(e.target.value)
            }
            placeholder={
              mode === "urls"
                ? "https://example.com/story\nOne link per line, five at most"
                : "Paste the article text here"
            }
            className="mt-4 w-full resize-y border border-ink bg-transparent p-3 text-[15px] leading-relaxed"
          />

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-ink px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-60"
            >
              Triage articles
            </button>
          </div>
        </form>

        <div aria-live="polite" className="mt-10">
          {loading && (
            <p className="font-display text-xl italic">Setting type...</p>
          )}

          {error && (
            <div className="border border-ink p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
                Correction
              </p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}

          {results?.map((r, i) => (
            <article
              key={i}
              className="border-t border-ink/30 py-8 first:border-t-0 first:pt-0"
            >
              {r.error ? (
                <div className="border border-ink p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
                    Correction
                  </p>
                  <p className="mt-1 text-sm">{r.error}</p>
                  {r.url && (
                    <p className="mt-2 break-all text-xs text-muted">{r.url}</p>
                  )}
                </div>
              ) : (
                <>
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${badge[r.verdict!]}`}
                  >
                    {r.verdict}
                  </span>
                  <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
                    {r.url ? (
                      <a
                        href={r.url}
                        className="underline-offset-4 hover:underline focus-visible:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </h2>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted">
                    {r.url ? `${domain(r.url)} · ` : ""}from{" "}
                    {r.word_count?.toLocaleString()} words · {r.read_minutes} min
                    read
                  </p>
                  <p className="mt-3 text-[17px] italic leading-relaxed">
                    {r.reason}
                  </p>

                  <h3 className="mt-6 border-b border-ink pb-1 text-[11px] uppercase tracking-[0.18em]">
                    The receipts
                  </h3>
                  {r.fact_count === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      No claim could be quoted from this article.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-5">
                      {r.key_facts?.map((f, j) => (
                        <li key={j}>
                          <p
                            className={
                              f.verified
                                ? "text-[15px] leading-relaxed"
                                : "text-[15px] leading-relaxed text-muted line-through"
                            }
                          >
                            {f.claim}
                          </p>
                          {f.verified ? (
                            <>
                              <blockquote className="mt-1 border-l-2 border-ink pl-3 text-[15px] italic leading-relaxed">
                                {f.quote}
                              </blockquote>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.18em]">
                                ✓ Verified
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-accent">
                              ✗ Not found in article
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-5 text-right text-[11px] uppercase tracking-[0.14em] text-muted">
                    {r.verified_count} of {r.fact_count} claims verified
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      </main>

      <footer className="mt-12 border-t border-ink/30 py-4 text-[11px] leading-snug text-muted">
        Demo, rate limited to 10 runs per hour. Sites that block bots need pasted
        text. Quotes are checked in code, not by the model.
      </footer>
    </div>
  );
}
