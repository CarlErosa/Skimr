import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyFacts } from "./verify.ts";

const article = `The startup raised $2 million in seed funding led by Foxmont Capital.
“We plan to hire 20 engineers by June,” said its founder — a former Grab executive.
Revenue grew 3x year over year.`;

test("an exact quote is verified", () => {
  const [fact] = verifyFacts(article, [
    { claim: "Raised seed money", quote: "raised $2 million in seed funding led by Foxmont Capital" },
  ]);
  assert.equal(fact.verified, true);
});

test("curly quotes, dashes and whitespace differences still verify", () => {
  const [fact] = verifyFacts(article, [
    {
      claim: "Hiring plan",
      quote: '"We plan to hire 20 engineers by June," said its founder - a former Grab executive',
    },
  ]);
  assert.equal(fact.verified, true);
});

test("a fabricated quote is not verified", () => {
  const facts = verifyFacts(article, [
    { claim: "Real fact", quote: "Revenue grew 3x year over year." },
    { claim: "Fabricated fact", quote: "The company was valued at $900 million." },
  ]);
  assert.deepEqual(facts.map((f) => f.verified), [true, false]);
});
