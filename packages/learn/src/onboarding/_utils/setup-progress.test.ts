import { describe, expect, it } from "vitest";
import { getProfileProgress, getSetupProgress } from "./setup-progress";

describe(getSetupProgress, () => {
  it("keeps the total when a beginner skips placement", () => {
    const before = getSetupProgress({
      current: "level",
      history: ["targetDate"],
      view: { steps: ["level", "buddy", "placement", "schedule", "plan"] },
    });

    const after = getSetupProgress({
      current: "buddy",
      history: ["targetDate", "level"],
      view: { steps: ["buddy", "schedule", "plan"] },
    });

    expect(before).toStrictEqual({ current: 1, total: 4 });
    expect(after).toStrictEqual({ current: 2, total: 4 });
  });

  it("counts setup questions after placement without counting the test", () => {
    expect(
      getSetupProgress({
        current: "schedule",
        history: ["targetDate", "level", "buddy", "placement"],
        view: { steps: ["schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 3, total: 4 });
  });

  it("leaves placement and the plan to their own progress", () => {
    for (const current of ["placement", "plan"] as const) {
      expect(
        getSetupProgress({
          current,
          history: ["level"],
          view: { steps: [current, "schedule", "plan"] },
        }),
      ).toBeNull();
    }
  });

  it("shows no dashes while a question that can add another is current or ahead", () => {
    const steps = ["contentCountry", "purpose", "level", "targetDate", "schedule", "plan"] as const;

    expect(
      getSetupProgress({ current: "contentCountry", history: [], view: { steps } }),
    ).toBeNull();

    expect(
      getSetupProgress({
        current: "purpose",
        history: ["contentCountry"],
        view: { steps: steps.slice(1) },
      }),
    ).toBeNull();

    expect(
      getSetupProgress({
        current: "level",
        history: ["contentCountry", "purpose"],
        view: { steps: ["level", "role", "targetDate", "schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 2, total: 6 });
  });

  it("hides setup dashes while the language aim can open exam questions", () => {
    expect(
      getSetupProgress({
        current: "reason",
        history: ["level", "followUps", "targetDate", "schedule"],
        view: { steps: ["reason", "plan"] },
      }),
    ).toBeNull();
  });

  it("keeps an earlier question's place when a later screen opens it again", () => {
    expect(
      getSetupProgress({
        current: "targetDate",
        history: ["purpose", "targetDate", "level", "schedule"],
        view: { steps: ["schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 1, total: 4 });
  });

  it("adds a question the learner never saw before the screen that opened it", () => {
    expect(
      getSetupProgress({
        current: "targetDate",
        history: ["target", "level", "schedule"],
        view: { steps: ["schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 2, total: 4 });
  });

  it("keeps a question's place when the plan asks it again", () => {
    expect(
      getSetupProgress({
        current: "targetDate",
        history: ["purpose", "targetDate", "level", "schedule"],
        view: { steps: ["targetDate", "schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 1, total: 4 });
  });
});

describe("profile steps", () => {
  const steps = ["work", "tools", "conditions", "learningSupport", "schedule", "plan"] as const;

  it("show their own count instead of setup dashes", () => {
    expect(
      getSetupProgress({ current: "tools", history: ["level", "work"], view: { steps } }),
    ).toBeNull();

    expect(
      getSetupProgress({
        current: "schedule",
        history: ["level", "work", "tools", "conditions", "learningSupport"],
        view: { steps: ["schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 2, total: 3 });
  });

  it("count this run's profile screens", () => {
    expect(
      getProfileProgress({
        current: "tools",
        history: ["level", "work"],
        view: { steps: steps.slice(1) },
      }),
    ).toStrictEqual({ canSkipAll: true, current: 2, total: 4 });

    expect(
      getProfileProgress({
        current: "conditions",
        history: ["level"],
        view: { steps: ["conditions", "learningSupport", "schedule", "plan"] },
      }),
    ).toStrictEqual({ canSkipAll: true, current: 1, total: 2 });

    expect(
      getProfileProgress({
        current: "learningSupport",
        history: ["conditions"],
        view: { steps: ["learningSupport", "schedule", "plan"] },
      }),
    ).toStrictEqual({ canSkipAll: false, current: 2, total: 2 });

    expect(getProfileProgress({ current: "schedule", history: [], view: { steps } })).toBeNull();
  });
});
