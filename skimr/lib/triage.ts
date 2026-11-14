import { GoogleGenAI } from "@google/genai";

export type Fact = { claim: string; quote: string };
export type Triage = {
  verdict: "read" | "skim" | "skip";
  reason: string;
  key_facts: Fact[];
};

const prompt = (title: string, text: string) => `You triage news for a Filipino startup founder who skims a lot and has little time.

Return ONLY JSON in this shape:
{"verdict":"read"|"skim"|"skip","reason":"one sentence","key_facts":[{"claim":"...","quote":"..."}]}

Rules:
- verdict: "read" means worth the full article, "skim" means the gist is enough, "skip" means not worth the minutes. Be honest and willing to say "skip".
- reason: one sentence telling the founder whether spending time on this is worth it.
- key_facts: 2 to 4 items. Every claim needs an exact supporting quote from the article.
- quote must be copied character for character from the article: copy the exact characters, do not fix typos or punctuation.
- Never paraphrase inside "quote". If a claim cannot be quoted, return fewer facts instead of inventing one.

Title: ${title}

Article:
${text}`;

function validate(value: unknown): Triage {
  const data = value as Partial<Triage> | null;
  const verdict = data?.verdict;
  if (verdict !== "read" && verdict !== "skim" && verdict !== "skip") {
    throw new Error("The model returned an unusable verdict.");
  }
  if (typeof data?.reason !== "string" || !data.reason.trim()) {
    throw new Error("The model returned no reason.");
  }
  const facts = Array.isArray(data.key_facts) ? data.key_facts : [];
  const key_facts = facts
    .filter((f): f is Fact => typeof f?.claim === "string" && typeof f?.quote === "string")
    .slice(0, 4);
  return { verdict, reason: data.reason.trim(), key_facts };
}

export async function triage(title: string, text: string): Promise<Triage> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.MODEL;
  if (!apiKey || !model) throw new Error("Server is missing GEMINI_API_KEY or MODEL.");

  let raw: string;
  try {
    const res = await new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: "v1beta",
        timeout: 20_000,
        // shortcut: no retries. The SDK retries 5xx five times by default, which
        // turns an overloaded model into a spinner that never resolves.
        retryOptions: { attempts: 1 },
      },
    }).models.generateContent({
      model,
      contents: prompt(title, text.slice(0, 15_000)),
      config: { temperature: 0.2, responseMimeType: "application/json" },
    });
    raw = (res.text ?? "").trim();
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 429) {
      throw new Error("The model is rate limiting this demo. Try again in a minute.");
    }
    if (status === 404 || status === 400) {
      throw new Error("The model name or API version is wrong. Check MODEL in .env.local.");
    }
    if (status === 503) {
      throw new Error("The model is busy right now. Try again in a minute.");
    }
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("The model did not answer in time. Try again or pick another MODEL.");
    }
    throw e;
  }

  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The model returned unreadable JSON.");
  }
  return validate(parsed);
}
