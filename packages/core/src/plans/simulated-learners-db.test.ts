import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { type SimFixtureName } from "./_test-utils/sim/sim-fixture";
import { generateSimLife } from "./_test-utils/sim/sim-life-plan";
import { isOpenFinding } from "./_test-utils/sim/sim-open-findings";

// The mistake classifier is a paid model call: a wrong answer whose cause isn't clear is a gap here.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({
  classifyMistakeCause: vi.fn(async () => ({ data: { cause: "gap" } })),
}));

// Vercel Blob is the external store a deleted account's files are removed from.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn(async () => ({ blobs: [], cursor: undefined, hasMore: false })),
}));

const MINUTE = 60_000;

/**
 * A short life of each kind, through the real capabilities: these seeds' steps cover every step
 * kind. With a question bank, the class test learners answer placement, practice and reviews in
 * their sessions, for the checks of what they know and of readiness (the Plus one takes the weekly
 * mock on the mock screen too), and the IELTS learner practices the listening skills with the
 * exam's recordings.
 */
const DB_LIVES: [SimFixtureName, number, "answering questions" | "no questions"][] = [
  ["class-test", 1003, "no questions"],
  ["career", 1001, "no questions"],
  ["language", 1006, "no questions"],
  ["class-test", 1001, "answering questions"],
  ["class-test", 1018, "answering questions"],
  ["ielts", 2, "answering questions"],
];

function describeViolations({
  fixture,
  violations,
}: {
  fixture: SimFixtureName;
  violations: { message: string; rule: string }[];
}) {
  return violations
    .filter((violation) => !isOpenFinding({ fixture, rule: violation.rule }))
    .map((violation) => `${violation.rule}: ${violation.message}`);
}

describe("simulated learners through the real capabilities", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(DB_LIVES)(
    "%s (seed %i, %s) keeps the owner's rules",
    async (fixture, seed, questions) => {
      const life = await generateSimLife({ fixture, seed });

      const { violations } = await runSimLifeInDb(life, {
        questions: questions === "answering questions",
      });

      expect(describeViolations({ fixture, violations })).toStrictEqual([]);
    },
    10 * MINUTE,
  );
});
