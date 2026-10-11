import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

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

/** R15 through the real capabilities: changing the plan, then reading it. */
describe("a base choice never pushes out a topic, through the real capabilities", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A class test 6 days away at 30 minutes a day: after the learner chose the core of prokaryotes
  // and eukaryotes over its quick lesson, two missed days set cell theory's only lesson aside. Then
  // they chose to study that base in depth: the change brought cell theory back in the nucleus's
  // place.
  it(
    "keeps a topic the plan holds when work set aside for time would take its place",
    async () => {
      const { violations } = await runSimLifeInDb({
        dailyMinutes: 30,
        fixture: "class-test",
        knownAreas: [],
        pending: [0, 2, 3],
        seed: 75,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.25, kind: "study", misses: [] },
          { kind: "change", spec: { base: 0, choice: "essential", kind: "bases" }, via: "editor" },
          { days: 2, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [5] },
          { kind: "change", spec: { base: 0, choice: "deep", kind: "bases" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 6,
      });

      expect(violations.filter((violation) => violation.rule === "R15")).toStrictEqual([]);
    },
    5 * MINUTE,
  );
});
