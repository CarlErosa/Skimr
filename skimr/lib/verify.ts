import type { Fact } from "./triage.ts";

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type CheckedFact = Fact & { verified: boolean };

export function verifyFacts(articleText: string, facts: Fact[]): CheckedFact[] {
  const haystack = normalize(articleText);
  return facts.map((fact) => ({
    ...fact,
    verified: normalize(fact.quote).length > 0 && haystack.includes(normalize(fact.quote)),
  }));
}
