import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const PRIVATE = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i,
];

const blocked = (host: string) =>
  host === "localhost" ||
  /\.(localhost|local|internal)$/.test(host) ||
  PRIVATE.some((r) => r.test(host));

// Throws a human-readable error for anything that is not a public http(s) URL.
async function assertPublic(raw: string | URL) {
  const url = typeof raw === "string" ? new URL(raw) : raw;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links work.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (blocked(host)) throw new Error("That address is not allowed.");
  if (isIP(host)) return;
  const ips = (await lookup(host, { all: true })).map((a) => a.address);
  if (!ips.length || ips.some(blocked)) throw new Error("That address is not allowed.");
  // shortcut: DNS can change between this lookup and the connect (rebinding).
  // To close it, resolve once and fetch the IP with a Host header.
}

export type Article = { url: string; title: string; text: string };

export async function fetchArticle(rawUrl: string): Promise<Article> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Skimr/0.1)" },
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      throw new Error(`The site answered ${res.status}. Paste the article text instead.`);
    }

    const dom = new JSDOM(await res.text(), { url: url.href });
    const parsed = new Readability(dom.window.document).parse();
    const text = (parsed?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 300) {
      throw new Error("Could not extract enough article text. Paste the text instead.");
    }
    return { url: url.href, title: parsed?.title?.trim() || url.hostname, text };
  }
  throw new Error("Too many redirects.");
}
