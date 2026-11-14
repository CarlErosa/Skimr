# Skimr

Read, skim, or skip. Every claim has a receipt.

Paste up to five news links (or an article's text) and Skimr returns a verdict for each: **read**, **skim**, or **skip**. Every supporting fact comes with a verbatim quote, and plain code checks that quote against the article text before it is shown. The model proposes; the code verifies.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY and MODEL
npm run dev                  # http://localhost:3000
npm test                     # verification unit tests, no network needed
```

`MODEL` is a Gemini model id, for example `gemini-2.5-flash`. The name lives in `.env.local` only, never in the source.

Deploy on Vercel: push the repo, set `GEMINI_API_KEY` and `MODEL` as environment variables. The route is a Node function with a 60 second ceiling.

## How it works

1. Fetch (10s timeout, max five redirect hops) and extract the article with Readability + linkedom. Under 300 characters counts as a failed extraction.
2. Truncate to 15,000 characters and send one Gemini call (`temperature 0.2`, JSON response mode) that must return a verdict, a one-sentence reason, and 2 to 4 claim/quote pairs.
3. **Verify in code.** Both the quote and the article are normalized (lowercase, whitespace collapsed, curly quotes and dashes made plain) and the quote must be a substring of the article. A quote the model invented stays in the response but is flagged, struck through, and its text is never shown as if it were real.
4. Results are sorted read, skim, skip, and one failed article never takes down the others.

## Decisions

- **A verdict, not a summary.** Founders do not need another summary, they need a decision and a time cost. The reason is one sentence.
- **Verification lives in code.** Asking the model to mark its own quotes as true is worthless. Normalized substring matching is boring, deterministic, and testable, and it catches the failure that matters: a confident paraphrase dressed up as a quote.
- **SSRF guard on every hop.** Only `http`/`https`, no localhost or private/link-local addresses, and the hostname is resolved and checked again after each redirect. Still open to DNS rebinding, which is noted in the code.
- **In-memory rate limit.** 10 runs per IP per hour. It is per serverless instance and resets on a cold start, so it is a speed bump for a public demo, not a quota.
- **Concurrency of two.** The Gemini free tier rate limits hard, so articles are processed in pairs: a request with five links finishes under the function ceiling without tripping the limit.

## What I left out and why

- Accounts, saved history, database: nothing to store yet, and auth would triple the code for a demo.
- Crawling whole sites, multi-source deduplication: one link, one article. Anything else is a product, not an hour.
- Personalization and profiles: relevance needs a real signal (your startup's sector, stage, competitors). Not enough time to fake it honestly.
- Browser extension: the real home for this is a sidebar on the article you are already reading. Next step, not today.
- Taglish output: the audience reads English news; localization is a copy decision, not a code one.
- Payments: a demo with a rate limit does not need a checkout.

## Next steps

- **Browser extension**: score the article on the page you are actually reading, no copy-paste.
- **Profile-based relevance**: a short profile (sector, stage, competitors) turns "is this good?" into "is this good for me?" without inventing facts.
- **Shared rate limit** in Vercel KV or Redis if the demo goes public.
- **Quote-verification telemetry**: log the share of unverified quotes per model and per prompt version. That number is the product's quality signal.

## The verification tests

`lib/verify.test.ts` runs on Node's built-in test runner, no dependencies:

- an exact quote verifies,
- a quote that differs only in curly quotes, dash style, and whitespace still verifies,
- a fabricated quote is marked unverified while the real one next to it stays verified.

## Demo mode

Not built yet. An optional, clearly labeled "simulate a bad claim" button can inject one fabricated fact so the verification step can be shown catching it. It is only added after the real flow works, and it would be labeled as a demo in the UI and here.
