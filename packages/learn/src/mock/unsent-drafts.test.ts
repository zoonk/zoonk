import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHandedInMockDrafts,
  dropUnsentMockDraft,
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
  questionIds = ["q1", "q2"],
  section = 0,
  status = "running",
}: { questionIds?: string[]; section?: number; status?: MockView["status"] } = {}): MockView {
  return {
    blockId: "mock-1",
    current:
      status === "running"
        ? {
            changedItemIds: [],
            changesLeft: null,
            deadline: "2030-01-01T00:00:00.000Z",
            drafts: [],
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
            section,
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

  it("stores each question under its own key and drops only the version acknowledged", () => {
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

    // Two tabs answering different questions write independent keys without overwriting each other.
    keepUnsentMockDraft({ blockId: "mock-1", draft: q1v1 });
    keepUnsentMockDraft({ blockId: "mock-1", draft: q2 });
    expect(globalThis.localStorage.getItem("mock:mock-1:q1")).not.toBeNull();
    expect(globalThis.localStorage.getItem("mock:mock-1:q2")).not.toBeNull();

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([
      q1v1,
      q2,
    ]);

    // Replacing q1 while q1v1 is in flight keeps q1v2 in its original enqueue slot when q1v1 finishes storing.
    keepUnsentMockDraft({ blockId: "mock-1", draft: q1v2 });
    dropUnsentMockDraft({ blockId: "mock-1", draft: q1v1 });

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([
      q1v2,
      q2,
    ]);

    dropUnsentMockDraft({ blockId: "mock-1", draft: q1v2 });
    dropUnsentMockDraft({ blockId: "mock-1", draft: q2 });
    expect(globalThis.localStorage).toHaveLength(0);
  });

  it("ignores malformed entries and clears all keys on finished mocks", () => {
    const kept: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 2500,
      flagged: true,
      itemId: "q1",
    };

    keepUnsentMockDraft({ blockId: "mock-1", draft: kept });
    globalThis.localStorage.setItem("mock:mock-1:bad", JSON.stringify({ bad: true }));

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView() })).toStrictEqual([kept]);

    expect(
      restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView({ status: "finished" }) }),
    ).toStrictEqual([]);

    expect(globalThis.localStorage).toHaveLength(0);
  });

  it("restores only the current section's answers and clears a section once it's handed in", () => {
    const first: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 3000,
      flagged: true,
      itemId: "q1",
    };

    const next: MockDraft = {
      answer: { selectedIndex: 2 },
      durationMs: 500,
      flagged: false,
      itemId: "q-next",
    };

    keepUnsentMockDraft({ blockId: "mock-1", draft: first });
    keepUnsentMockDraft({ blockId: "mock-1", draft: next });

    const section1 = makeView({ questionIds: ["q1", "q2"] });
    const section2 = makeView({ questionIds: ["q-next"], section: 1 });

    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: section1 })).toStrictEqual([first]);

    clearHandedInMockDrafts({ blockId: "mock-1", next: section1, previous: section1 });
    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: section1 })).toStrictEqual([first]);

    clearHandedInMockDrafts({ blockId: "mock-1", next: section2, previous: section1 });
    expect(globalThis.localStorage.getItem("mock:mock-1:q1")).toBeNull();
    expect(restoreUnsentMockDrafts({ blockId: "mock-1", view: section2 })).toStrictEqual([next]);

    expect(
      restoreUnsentMockDrafts({ blockId: "mock-1", view: makeView({ status: "expired" }) }),
    ).toStrictEqual([]);

    expect(globalThis.localStorage).toHaveLength(0);
  });

  it("preserves original enqueue order when reviewing earlier forward-only questions offline", () => {
    const q1: MockDraft = {
      answer: { selectedIndex: 0 },
      durationMs: 1000,
      flagged: false,
      itemId: "q1",
    };

    const q2: MockDraft = {
      answer: { selectedIndex: 1 },
      durationMs: 1000,
      flagged: false,
      itemId: "q2",
    };

    const q3: MockDraft = {
      answer: { selectedIndex: 0 },
      durationMs: 1000,
      flagged: false,
      itemId: "q3",
    };

    // Offline learner answers q1 -> q2 -> q3, then reviews q1 and q2 (updating duration on leave).
    keepUnsentMockDraft({ blockId: "mock-1", draft: q1 });
    keepUnsentMockDraft({ blockId: "mock-1", draft: q2 });
    keepUnsentMockDraft({ blockId: "mock-1", draft: q3 });
    keepUnsentMockDraft({ blockId: "mock-1", draft: { ...q1, durationMs: 2500 } });
    keepUnsentMockDraft({ blockId: "mock-1", draft: { ...q2, durationMs: 3000 } });

    const restored = restoreUnsentMockDrafts({
      blockId: "mock-1",
      view: makeView({ questionIds: ["q1", "q2", "q3"] }),
    });

    expect(restored.map((draft) => draft.itemId)).toStrictEqual(["q1", "q2", "q3"]);

    dropUnsentMockDraft({ blockId: "mock-1", draft: { ...q1, durationMs: 2500 } });
    dropUnsentMockDraft({ blockId: "mock-1", draft: { ...q2, durationMs: 3000 } });

    keepUnsentMockDraft({
      blockId: "mock-1",
      draft: { ...q1, answer: { selectedIndex: 1 }, durationMs: 4000 },
    });

    const afterReviewChange = restoreUnsentMockDrafts({
      blockId: "mock-1",
      view: makeView({ questionIds: ["q1", "q2", "q3"] }),
    });

    expect(afterReviewChange.map((draft) => draft.itemId)).toStrictEqual(["q3", "q1"]);
  });
});
