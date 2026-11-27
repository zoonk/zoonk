import { describe, expect, it } from "vitest";
import { getShownLesson } from "./shown-lesson";

const asked = { generationId: "run-asked-for", lesson: "notStarted", runStopped: false } as const;

describe(getShownLesson, () => {
  it("shows a lesson the learner asked for as failed once readiness says its writing failed", () => {
    const read = { generationId: null, setAside: false, status: "failed" } as const;

    expect(getShownLesson({ ...asked, read })).toStrictEqual({
      generationId: "run-asked-for",
      lesson: "failed",
    });
  });

  it("keeps waiting on the asked-for run while readiness hasn't seen it take the lesson", () => {
    const read = { generationId: null, setAside: false, status: "notStarted" } as const;

    expect(getShownLesson({ ...asked, read }).lesson).toBe("notStarted");
  });

  it("keeps a failed lesson's earlier answer out of a request that has no run yet", () => {
    const read = { generationId: null, setAside: false, status: "failed" } as const;

    expect(getShownLesson({ ...asked, generationId: null, read }).lesson).toBe("notStarted");
  });

  it("shows the asked-for lesson as failed once its run stops", () => {
    const read = { generationId: null, setAside: false, status: "notStarted" } as const;

    expect(getShownLesson({ ...asked, read, runStopped: true }).lesson).toBe("failed");
  });

  it("follows the run readiness confirms is writing", () => {
    const read = { generationId: "run-writing", setAside: false, status: "generating" } as const;

    expect(getShownLesson({ ...asked, read })).toStrictEqual({
      generationId: "run-writing",
      lesson: "writing",
    });
  });
});
