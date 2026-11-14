import { fetchArticle } from "@/lib/fetch-article";
import { triage } from "@/lib/triage";
import { verifyFacts, type CheckedFact } from "@/lib/verify";

export const maxDuration = 60;

type Result = {
  url: string | null;
  title: string;
  word_count?: number;
  read_minutes?: number;
  verdict?: "read" | "skim" | "skip";
  reason?: string;
  key_facts?: CheckedFact[];
  verified_count?: number;
  fact_count?: number;
  error?: string;
};

const WINDOW = 60 * 60 * 1000;
const LIMIT = 10;
const hits = new Map<string, { count: number; reset: number }>();

// shortcut: per serverless instance and lost on cold start, so it is a speed bump, not a quota.
// Upgrade path: Redis or Vercel KV shared counter.
function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

const bad = (error: string) => Response.json({ error }, { status: 400 });

type Input = { url: string | null; title: string; text: string | null };

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "That is 10 runs this hour. This is a demo, so take a breath and try later." },
      { status: 429 },
    );
  }

  let body: { mode?: unknown; urls?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Send a JSON body with a mode and some content.");
  }

  let inputs: Input[];
  if (body.mode === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 300) return bad("Paste at least a few hundred characters.");
    if (text.length > 200_000) return bad("That text is too long. Keep it under 200,000 characters.");
    inputs = [{ url: null, title: "Pasted article", text }];
  } else if (body.mode === "urls") {
    const urls = Array.isArray(body.urls)
      ? body.urls
          .filter((u): u is string => typeof u === "string")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];
    if (!urls.length) return bad("Add one to five article links.");
    if (urls.length > 5) return bad("Five links max per run.");
    inputs = urls.map((url) => ({ url, title: url, text: null }));
  } else {
    return bad('Pick mode "urls" or "text".');
  }

  const run = async (input: Input): Promise<Result> => {
    try {
      const article = input.text
        ? { url: null, title: input.title, text: input.text }
        : await fetchArticle(input.url!);
      const words = article.text.split(" ").length;
      const triaged = await triage(article.title, article.text);
      const facts = verifyFacts(article.text, triaged.key_facts);
      return {
        url: article.url,
        title: article.title,
        word_count: words,
        read_minutes: Math.max(1, Math.ceil(words / 220)),
        verdict: triaged.verdict,
        reason: triaged.reason,
        key_facts: facts,
        verified_count: facts.filter((f) => f.verified).length,
        fact_count: facts.length,
      };
    } catch (e) {
      return {
        url: input.url,
        title: input.title,
        error: e instanceof Error ? e.message : "Something went wrong.",
      };
    }
  };

  const results: Result[] = [];
  for (let i = 0; i < inputs.length; i += 2) {
    results.push(...(await Promise.all(inputs.slice(i, i + 2).map(run))));
  }

  const rank = { read: 0, skim: 1, skip: 2 };
  results.sort(
    (a, b) =>
      (a.verdict ? rank[a.verdict] : 3) - (b.verdict ? rank[b.verdict] : 3),
  );

  return Response.json({ results });
}
