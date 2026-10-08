import { type ExtractedMemoryFact } from "@zoonk/ai/tasks/v2/memory/extraction";
import { describe, expect, it } from "vitest";
import { isSameStatement, toMemoryCandidates } from "./memory-candidates";

const TODAY = new Date(Date.UTC(2026, 8, 26));
const ALL = ["goals", "background", "routine", "preferences", "learning", "context"] as const;

function fact(fields: Partial<ExtractedMemoryFact>): ExtractedMemoryFact {
  return {
    category: "goals",
    evidence: "quote",
    expiresOn: null,
    intent: "remember",
    origin: "said",
    statement: "Wants Law",
    ...fields,
  };
}

describe(toMemoryCandidates, () => {
  it("cleans statements and sets confidence from where the fact came from", () => {
    expect(
      toMemoryCandidates({
        categories: ALL,
        facts: [
          fact({ statement: "  Wants   Law  " }),
          fact({ category: "learning", origin: "noticed", statement: "Mixes up signs" }),
        ],
        source: "chat",
        today: TODAY,
      }),
    ).toStrictEqual([
      {
        category: "goals",
        confidence: 0.9,
        evidence: "quote",
        expiresAt: null,
        intent: "remember",
        origin: "said",
        statement: "Wants Law",
      },
      {
        category: "learning",
        confidence: 0.6,
        evidence: "quote",
        expiresAt: null,
        intent: "remember",
        origin: "noticed",
        statement: "Mixes up signs",
      },
    ]);
  });

  it("expires a fact after its last day, drops facts already over and ignores unreal dates", () => {
    const candidates = toMemoryCandidates({
      categories: ALL,
      facts: [
        fact({ expiresOn: "2026-11-08", statement: "Has the ENEM on November 8" }),
        fact({ expiresOn: "2026-09-26", statement: "Has a test today" }),
        fact({ expiresOn: "2026-09-25", statement: "Had a test yesterday" }),
        fact({ expiresOn: "2026-02-30", statement: "Has a trip in February" }),
        fact({ expiresOn: "next week", statement: "Has a deadline" }),
      ],
      source: "chat",
      today: TODAY,
    });

    expect(candidates.map((candidate) => [candidate.statement, candidate.expiresAt])).toStrictEqual(
      [
        ["Has the ENEM on November 8", new Date(Date.UTC(2026, 10, 9))],
        ["Has a test today", new Date(Date.UTC(2026, 8, 27))],
        ["Has a trip in February", null],
        ["Has a deadline", null],
      ],
    );
  });

  it("keeps only the categories the learner's memory may hold", () => {
    const candidates = toMemoryCandidates({
      categories: ["goals", "learning"],
      facts: [fact({ category: "context", statement: "Lives in Recife" }), fact({})],
      source: "chat",
      today: TODAY,
    });

    expect(candidates.map((candidate) => candidate.statement)).toStrictEqual(["Wants Law"]);
  });

  it("reads session numbers only as noticed learning facts, never when or how long they study", () => {
    const candidates = toMemoryCandidates({
      categories: ALL,
      facts: [
        fact({ category: "goals", statement: "Wants a high score" }),
        fact({ category: "routine", origin: "said", statement: "Studies about 6 minutes a day" }),
        fact({ category: "learning", origin: "said", statement: "Mixes up fractions" }),
      ],
      source: "session",
      today: TODAY,
    });

    expect(candidates).toMatchObject([
      { category: "learning", confidence: 0.6, origin: "noticed", statement: "Mixes up fractions" },
    ]);
  });

  it("keeps the first copy of a repeated statement, a handful at most, and drops empty or long ones", () => {
    const candidates = toMemoryCandidates({
      categories: ALL,
      facts: [
        fact({ statement: "Wants Law" }),
        fact({ statement: "wants  law" }),
        fact({ intent: "forget", statement: "Wants Law" }),
        fact({ statement: "  " }),
        fact({ statement: "x".repeat(161) }),
        ...["A", "B", "C", "D", "E"].map((letter) => fact({ statement: `Fact ${letter}` })),
      ],
      source: "chat",
      today: TODAY,
    });

    expect(
      candidates.map((candidate) => `${candidate.intent}:${candidate.statement}`),
    ).toStrictEqual([
      "remember:Wants Law",
      "forget:Wants Law",
      "remember:Fact A",
      "remember:Fact B",
      "remember:Fact C",
    ]);
  });
});

describe(isSameStatement, () => {
  it("ignores case, accents and spacing", () => {
    expect(isSameStatement("Quer  Direito na USP", "quer direito na usp")).toBe(true);
    expect(isSameStatement("Estuda à noite", "Estuda a noite")).toBe(true);
    expect(isSameStatement("Wants Law", "Wants Medicine")).toBe(false);
  });
});
