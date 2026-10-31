import { describe, expect, it } from "vitest";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { WAITING_RUN, hasWaitFailed, isPlanBuilding, waitsForPlan } from "./wait-run";

describe(hasWaitFailed, () => {
  it.each<PollStatus>(["idle", "polling"])("keeps a healthy notice wait open while %s", (poll) => {
    expect(hasWaitFailed({ poll, run: WAITING_RUN })).toBe(false);
  });

  it.each<PollStatus>(["failed", "timedOut"])("offers recovery when the poll is %s", (poll) => {
    expect(hasWaitFailed({ poll, run: WAITING_RUN })).toBe(true);
  });

  it("offers recovery when the workflow failed even while polling continues", () => {
    expect(
      hasWaitFailed({
        poll: "polling",
        run: { failure: "connection", status: "failed", steps: {} },
      }),
    ).toBe(false);

    expect(
      hasWaitFailed({
        poll: "polling",
        run: { failure: "generation", status: "failed", steps: {} },
      }),
    ).toBe(true);
  });
});

const building: GenerationRun = {
  failure: null,
  status: "following",
  steps: { buildSkillGraph: "started", understandGoal: "completed" },
};

const made: GenerationRun = {
  failure: null,
  status: "following",
  steps: { createPlan: "completed", outlineCourses: "started" },
};

describe(isPlanBuilding, () => {
  it("is true while the run reports steps without having made the plan", () => {
    const failed: GenerationRun = { ...building, failure: "generation", status: "failed" };

    expect(isPlanBuilding(building)).toBe(true);
    expect(isPlanBuilding(failed)).toBe(true);
  });

  it("is false once the run made the plan or is done", () => {
    expect(isPlanBuilding(made)).toBe(false);
    expect(isPlanBuilding({ ...building, status: "ready" })).toBe(false);
  });

  it("is false while the run hasn't said where it is", () => {
    expect(isPlanBuilding(WAITING_RUN)).toBe(false);
    expect(isPlanBuilding({ ...WAITING_RUN, status: "following" })).toBe(false);
    expect(isPlanBuilding(null)).toBe(false);
  });
});

describe(waitsForPlan, () => {
  const asking = { last: null, status: "polling" as const };
  const notReady = { last: { readingNotice: false, ready: false }, status: "polling" as const };

  it("shows the wait before the plan's first answer when the step opened on a plan being built", () => {
    expect(waitsForPlan({ gate: asking, openedBuilding: true, run: building })).toBe(true);
  });

  it("keeps the question before the first answer when the step opened without that", () => {
    expect(waitsForPlan({ gate: asking, openedBuilding: false, run: made })).toBe(false);
    expect(waitsForPlan({ gate: asking, openedBuilding: false, run: building })).toBe(false);
  });

  it("shows the question when it doesn't ask the plan", () => {
    const idle = { last: null, status: "idle" as const };
    expect(waitsForPlan({ gate: idle, openedBuilding: true, run: building })).toBe(false);
  });

  it("waits while the plan says it isn't ready and its run goes on", () => {
    expect(waitsForPlan({ gate: notReady, openedBuilding: false, run: made })).toBe(true);
  });

  it("asks once the plan is ready, or once its run is done", () => {
    const ready = { last: { readingNotice: false, ready: true }, status: "idle" as const };
    const done: GenerationRun = { ...made, status: "ready" };

    expect(waitsForPlan({ gate: ready, openedBuilding: true, run: building })).toBe(false);
    expect(waitsForPlan({ gate: notReady, openedBuilding: true, run: done })).toBe(false);
  });

  it("waits while the exam's notice is read, even once the run is done", () => {
    const reading = { last: { readingNotice: true, ready: false }, status: "polling" as const };
    const done: GenerationRun = { ...made, status: "ready" };

    expect(waitsForPlan({ gate: reading, openedBuilding: false, run: done })).toBe(true);
  });
});
