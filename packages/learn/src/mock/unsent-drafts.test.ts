import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHandedInMockDrafts,
  dropUnsentMockDraft,
  getForwardOnlyKeptReached,
  keepUnsentMockDraft,
  restoreUnsentMockDrafts,
} from "./unsent-drafts";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function makeView({
  drafts = [],
  questionIds = ["q1", "q2"],
  status = "running",
}: { drafts?: MockDraft[]; questionIds?: string[]; status?: MockView["status"] } = {}): MockView {
  return {
    blockId: "mock-1",
    current:
      status === "running"
        ? {
            changesLeft: null,
            deadline: "2030-01-01T00:00:00.000Z",
            drafts,
            kind: null,
            plays: [],
            questions: questionIds.map((itemId, index) => ({
              area: null,
              context: null,
              entry: null,
              format: "multipleChoice",
              image: null,
              itemId,
              number: index + 1,
              options: ["A", "B"],
              question: `Question ${index + 1}`,
              select: null,
              set: null,
              skillId: "skill-1",
              unit: null,
              visual: null,
            })),
            resume: 0,
            section: 0,
          }
        : null,
    status,
  } as unknown as MockView;
}

describe("unsent mock drafts", () => {
  const originalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalStorage,
    });
  });

  it("keeps per-question drafts across tabs and drops only the version acknowledged", () => {
    const q1v1: MockDraft = {
      answer: { selectedIndex: 0 },
      durationMs: 1000,
      flagged: false,
      itemId: "q1",
    };

    const q1v2: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 2500,
      flagged: true,
      itemId: "q1",
    };

    const q2: MockDraft = {
      answer: { text: "Paris" },
      durationMs: 0,
      flagged: false,
      itemId: "q2",
    };

    // Two open tabs answering different questions keep both entries.
    keepUnsentMockDraft({ blockId: "mock-1", draft: q1v1 });
    keepUnsentMockDraft({ blockId: "mock-1", draft: q2 });

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([
      q1v1,
      q2,
    ]);

    // Replacing q1 while q1v1 is in flight keeps q1v2 when q1v1 finishes storing.
    keepUnsentMockDraft({ blockId: "mock-1", draft: q1v2 });
    dropUnsentMockDraft({ blockId: "mock-1", draft: q1v1 });

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([
      q1v2,
      q2,
    ]);

    dropUnsentMockDraft({ blockId: "mock-1", draft: q1v2 });
    dropUnsentMockDraft({ blockId: "mock-1", draft: q2 });
    expect(globalThis.localStorage.getItem("mock:mock-1")).toBeNull();
  });

  it("ignores malformed entries and clears on finished mocks", () => {
    const kept: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 2500,
      flagged: true,
      itemId: "q1",
    };

    globalThis.localStorage.setItem(
      "mock:mock-1",
      JSON.stringify([kept, { bad: true }, { answer: { selectedIndex: -1 }, itemId: "q2" }]),
    );

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([kept]);

    expect(
      restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView({ status: "finished" }) }),
    ).toStrictEqual([]);

    expect(globalThis.localStorage.getItem("mock:mock-1")).toBeNull();
  });

  it("preserves another section's drafts while dropping already-stored and handed-in entries", () => {
    const stored: MockDraft = {
      answer: { selectedIndex: 0 },
      durationMs: 1200,
      flagged: false,
      itemId: "q1",
    };

    const unsent: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 3000,
      flagged: true,
      itemId: "q2",
    };

    const nextSection: MockDraft = {
      answer: { selectedIndex: 2 },
      durationMs: 500,
      flagged: false,
      itemId: "q-next",
    };

    keepUnsentMockDraft({ blockId: "mock-1", draft: stored });
    keepUnsentMockDraft({ blockId: "mock-1", draft: unsent });
    keepUnsentMockDraft({ blockId: "mock-1", draft: nextSection });

    // An older tab on section 1 restores only section 1 and preserves tab B's section 2 draft.
    const section1 = makeView({ drafts: [stored], questionIds: ["q1", "q2"] });
    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: section1 })).toStrictEqual([unsent]);

    expect(JSON.parse(globalThis.localStorage.getItem("mock:mock-1") ?? "[]")).toStrictEqual([
      unsent,
      nextSection,
    ]);

    // Reverting back to the opening draft offline stays unsent once a newer draft was stored.
    const reverted: MockDraft = {
      answer: { text: "Paris" },
      durationMs: 0,
      flagged: false,
      itemId: "q1",
    };

    const acknowledged: MockDraft = {
      answer: { text: "Lyon" },
      durationMs: 0,
      flagged: false,
      itemId: "q1",
    };

    keepUnsentMockDraft({ blockId: "mock-1", draft: reverted });

    expect(
      restoreUnsentMockDrafts({
        blockId: "mock-1",
        storedDrafts: { q1: acknowledged },
        view: makeView({ drafts: [reverted], questionIds: ["q1", "q2"] }),
      }),
    ).toStrictEqual([unsent, reverted]);

    // Handing in section 1 removes section 1's entries while keeping section 2's unsent draft.
    const section2 = makeView({ questionIds: ["q-next"] });
    clearHandedInMockDrafts({ blockId: "mock-1", next: section2, previous: section1 });

    expect(JSON.parse(globalThis.localStorage.getItem("mock:mock-1") ?? "[]")).toStrictEqual([
      nextSection,
    ]);

    expect(
      restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView({ status: "expired" }) }),
    ).toStrictEqual([]);

    expect(globalThis.localStorage.getItem("mock:mock-1")).toBeNull();
  });

  it("advances reached to the furthest recovered draft in forward-only sections only", () => {
    const view = {
      ...makeView({ questionIds: ["q1", "q2", "q3"] }),
      sections: [
        {
          breakAfterMinutes: null,
          essays: 0,
          index: 0,
          minutes: 30,
          name: "Part 1",
          navigation: { answerChanges: 0, forwardOnly: true, itemSeconds: null, mustAnswer: false },
          questions: 3,
          status: "current" as const,
          tools: null,
        },
      ],
    } as unknown as MockView;

    const kept: MockDraft[] = [
      { answer: { selectedIndex: 0 }, durationMs: 1000, flagged: false, itemId: "q2" },
    ];

    expect(getForwardOnlyKeptReached({ kept, view })).toBe(1);

    const freeView = {
      ...view,
      sections: [{ ...view.sections[0], navigation: null }],
    } as unknown as MockView;

    expect(getForwardOnlyKeptReached({ kept, view: freeView })).toBe(-1);
  });
});
