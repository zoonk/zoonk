import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type LessonGenerationState } from "@zoonk/core/library/generation/state";
import { type DayStep } from "@zoonk/learn/session/types";
import { describe, expect, it } from "vitest";
import { getNextStopLesson, getNotWritten, getWritingRunId } from "./next-step-lesson";

const LESSON_STEP = { kind: "learn", lessonId: "lesson", position: 1 } as DayStep;
const IDLE: LessonRequest = { status: "idle" };
const ASKED: LessonRequest = { generationId: "run-asked", status: "writing" };
const NOT_STARTED: LessonGenerationState = { status: "notStarted" };

describe(getNextStopLesson, () => {
  it("offers Start for a lesson nobody asked to write, without claiming it's being written", () => {
    expect(
      getNextStopLesson({ limit: null, request: IDLE, state: NOT_STARTED, step: LESSON_STEP }),
    ).toBe("ready");
  });

  it("waits for a lesson the learner asked for that no run picked up yet", () => {
    const facts = { request: ASKED, state: NOT_STARTED };

    expect(getNextStopLesson({ ...facts, limit: null, step: LESSON_STEP })).toBe("notStarted");
    expect(getWritingRunId(facts)).toBe("run-asked");
  });

  it("waits for a step being prepared, with no run to follow until one picks its lesson", () => {
    const facts = { request: { status: "requesting" }, state: null } as const;
    const placeholder = { kind: "learn", lessonId: null, position: 1 } as DayStep;

    expect(getNextStopLesson({ ...facts, limit: null, step: placeholder })).toBe("notStarted");
    expect(getWritingRunId(facts)).toBeNull();
  });

  it("follows the run the lesson names while it's written, over the one the address carries", () => {
    const facts = { request: ASKED, state: { runId: "run-lesson", status: "generating" } } as const;

    expect(getNextStopLesson({ ...facts, limit: null, step: LESSON_STEP })).toBe("writing");
    expect(getWritingRunId(facts)).toBe("run-lesson");
  });

  it("says why a refused request won't be written, in the wait's place", () => {
    const limit = { period: "month", status: "limitReached", tier: "free" } as const;
    const facts = { limit, request: IDLE, state: NOT_STARTED };
    const lesson = getNextStopLesson({ ...facts, step: LESSON_STEP });

    expect(lesson).toBe("notStarted");
    expect(getNotWritten({ ...facts, lesson })).toStrictEqual({ limit, status: "refused" });
  });

  it("opens a written lesson even when the address still carries the request that wrote it", () => {
    const facts = { request: ASKED, state: { status: "ready" } } as const;

    expect(getNextStopLesson({ ...facts, limit: null, step: LESSON_STEP })).toBe("ready");
    expect(getWritingRunId(facts)).toBeNull();
  });
});
