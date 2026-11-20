import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearUnsentMockDrafts,
  combinePendingMockDrafts,
  readUnsentMockDrafts,
  selectKeptDraftsForView,
  writeUnsentMockDrafts,
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

  it("reads back kept drafts, ignores malformed entries, and clears when empty", () => {
    const kept: MockDraft[] = [
      { answer: { selectedIndex: 1 }, durationMs: 2500, flagged: true, itemId: "q1" },
      { answer: { text: "Paris" }, durationMs: 0, flagged: false, itemId: "q2" },
    ];

    writeUnsentMockDrafts({ blockId: "mock-1", drafts: kept });
    expect(readUnsentMockDrafts("mock-1")).toStrictEqual(kept);

    globalThis.localStorage.setItem(
      "mock:mock-1",
      JSON.stringify([kept[0], { bad: true }, { answer: { selectedIndex: -1 }, itemId: "q2" }]),
    );

    expect(readUnsentMockDrafts("mock-1")).toStrictEqual([kept[0]]);

    writeUnsentMockDrafts({ blockId: "mock-1", drafts: [] });
    expect(globalThis.localStorage.getItem("mock:mock-1")).toBeNull();

    writeUnsentMockDrafts({ blockId: "mock-1", drafts: kept });
    clearUnsentMockDrafts("mock-1");
    expect(readUnsentMockDrafts("mock-1")).toStrictEqual([]);
  });

  it("merges unsaved typed text into pending drafts without losing queue order", () => {
    const q1: MockDraft = {
      answer: { selectedIndex: 0 },
      durationMs: 1000,
      flagged: false,
      itemId: "q1",
    };

    const q2Old: MockDraft = {
      answer: { text: "Par" },
      durationMs: 0,
      flagged: false,
      itemId: "q2",
    };

    const q2New: MockDraft = {
      answer: { text: "Paris" },
      durationMs: 0,
      flagged: false,
      itemId: "q2",
    };

    const q3: MockDraft = { answer: { text: "Lyon" }, durationMs: 0, flagged: false, itemId: "q3" };

    expect(combinePendingMockDrafts({ pending: [q1, q2Old], unsavedText: q2New })).toStrictEqual([
      q1,
      q2New,
    ]);

    expect(combinePendingMockDrafts({ pending: [q1], unsavedText: q3 })).toStrictEqual([q1, q3]);
    expect(combinePendingMockDrafts({ pending: [q1], unsavedText: null })).toStrictEqual([q1]);
  });

  it("keeps only drafts for the current section that differ from what the server already stored", () => {
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

    const oldSection: MockDraft = {
      answer: { selectedIndex: 2 },
      durationMs: 500,
      flagged: false,
      itemId: "q-old",
    };

    expect(
      selectKeptDraftsForView({
        kept: [stored, unsent, oldSection],
        view: makeView({ drafts: [stored], questionIds: ["q1", "q2"] }),
      }),
    ).toStrictEqual([unsent]);

    expect(
      selectKeptDraftsForView({ kept: [unsent], view: makeView({ status: "finished" }) }),
    ).toStrictEqual([]);

    expect(
      selectKeptDraftsForView({ kept: [unsent], view: makeView({ status: "expired" }) }),
    ).toStrictEqual([]);
  });
});
