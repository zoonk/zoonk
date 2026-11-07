import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type UnsentAnswer,
  dropUnsentAnswer,
  keepUnsentAnswer,
  readUnsentAnswers,
} from "./unsent-answers";

const stored = new Map<string, string>();

const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() {
    return stored.size;
  },
  removeItem: (key: string) => stored.delete(key),
  setItem: (key: string, value: string) => stored.set(key, value),
};

function unsentAnswer(overrides: Partial<UnsentAnswer> = {}): UnsentAnswer {
  return {
    answer: { kind: "check", optionId: "right" },
    answeredAt: "2026-11-07T10:00:00.000Z",
    attemptId: crypto.randomUUID(),
    durationMs: 4000,
    isCorrect: true,
    runId: "run",
    stepId: "quiz",
    usedHelp: false,
    ...overrides,
  };
}

const MAYA = { learnerId: "maya", lessonId: "atoms" };

describe("answers kept on the device until they're saved", () => {
  beforeEach(() => {
    stored.clear();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads back a learner's answers to a lesson, oldest first, and forgets one once dropped", () => {
    const retry = unsentAnswer({ answeredAt: "2026-11-07T10:02:00.000Z" });
    const miss = unsentAnswer({ answeredAt: "2026-11-07T10:01:00.000Z", isCorrect: false });

    keepUnsentAnswer({ ...MAYA, answer: retry });
    keepUnsentAnswer({ ...MAYA, answer: miss });

    expect(readUnsentAnswers(MAYA)).toStrictEqual([miss, retry]);

    dropUnsentAnswer({ ...MAYA, attemptId: miss.attemptId });
    expect(readUnsentAnswers(MAYA)).toStrictEqual([retry]);
  });

  it("never hands out another learner's answers or another lesson's", () => {
    keepUnsentAnswer({ answer: unsentAnswer(), learnerId: "maya", lessonId: "atoms-2" });
    keepUnsentAnswer({ answer: unsentAnswer(), learnerId: "maya-2", lessonId: "atoms" });
    keepUnsentAnswer({ answer: unsentAnswer(), learnerId: "sam", lessonId: "atoms" });

    expect(readUnsentAnswers(MAYA)).toStrictEqual([]);
  });

  it("leaves out an entry it can't send again", () => {
    const kept = unsentAnswer();

    keepUnsentAnswer({ ...MAYA, answer: kept });
    stored.set("lesson-unsent:maya:atoms:broken", "{not json");
    stored.set("lesson-unsent:maya:atoms:no-run", JSON.stringify({ ...kept, runId: undefined }));

    expect(readUnsentAnswers(MAYA)).toStrictEqual([kept]);
  });

  it("finds nothing when the browser blocks storage", () => {
    vi.stubGlobal("localStorage", {
      get length(): number {
        throw new Error("Storage is blocked");
      },
    });

    expect(readUnsentAnswers(MAYA)).toStrictEqual([]);
  });
});
