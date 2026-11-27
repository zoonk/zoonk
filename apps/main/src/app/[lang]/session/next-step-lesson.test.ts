import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type DayStep, type LessonStatus } from "@zoonk/learn/session/types";
import { describe, expect, it } from "vitest";
import { getAskedRunId, getNextStopLesson, getNotWritten } from "./next-step-lesson";

const IDLE: LessonRequest = { status: "idle" };
const ASKED: LessonRequest = { generationId: "run-asked", status: "writing" };

function lessonStep(status: LessonStatus | null, setAside = false): DayStep {
  return {
    kind: "learn",
    lesson: status ? { setAside, status } : null,
    lessonId: "lesson",
    position: 1,
  } as DayStep;
}

describe(getNextStopLesson, () => {
  it("offers Start for a lesson nobody asked to write, without claiming it's being written", () => {
    expect(getNextStopLesson({ limit: null, request: IDLE, step: lessonStep("notStarted") })).toBe(
      "ready",
    );
  });

  it("waits for a lesson the learner asked for that no run picked up yet", () => {
    const facts = { request: ASKED, step: lessonStep("notStarted") };

    expect(getNextStopLesson({ ...facts, limit: null })).toBe("notStarted");
    expect(getAskedRunId(facts)).toBe("run-asked");
  });

  it("waits for Try again's run while the saved lesson still says the last try failed", () => {
    const facts = { request: ASKED, step: lessonStep("failed") };

    expect(getNextStopLesson({ ...facts, limit: null })).toBe("notStarted");
    expect(getAskedRunId(facts)).toBe("run-asked");
  });

  it("shows a saved claim as being written, with no run until readiness confirms one", () => {
    const facts = { request: IDLE, step: lessonStep("generating") };

    expect(getNextStopLesson({ ...facts, limit: null })).toBe("writing");
    expect(getAskedRunId(facts)).toBeNull();
  });

  it("shows a failed lesson as failed, and a set-aside one with its reason", () => {
    const failed = { limit: null, request: IDLE, step: lessonStep("failed") };
    const setAside = { limit: null, request: IDLE, step: lessonStep("failed", true) };

    expect(getNextStopLesson(failed)).toBe("failed");
    expect(getNotWritten({ ...failed, lesson: "failed" })).toBeNull();
    expect(getNotWritten({ ...setAside, lesson: "failed" })).toStrictEqual({ status: "setAside" });
  });

  it("says why a refused request won't be written, in the wait's place", () => {
    const limit = { period: "day", status: "limitReached", tier: "free" } as const;
    const facts = { limit, request: IDLE, step: lessonStep("notStarted") };
    const lesson = getNextStopLesson(facts);

    expect(lesson).toBe("notStarted");
    expect(getNotWritten({ ...facts, lesson })).toStrictEqual({ limit, status: "refused" });
  });

  it("opens a written lesson even when the address still carries the request that wrote it", () => {
    const facts = { request: ASKED, step: lessonStep("ready") };

    expect(getNextStopLesson({ ...facts, limit: null })).toBe("ready");
    expect(getAskedRunId(facts)).toBeNull();
  });
});
