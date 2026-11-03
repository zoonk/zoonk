import {
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { describe, expect, it } from "vitest";
import { type FlowState, applyAnswer, openStep } from "./answered-step";

function viewWith(steps: OnboardingStep[]): OnboardingView {
  return { steps } as unknown as OnboardingView;
}

const onPurpose: FlowState = {
  current: "purpose",
  history: [],
  view: viewWith(["purpose", "role", "targetDate", "level"]),
};

describe(applyAnswer, () => {
  it("moves on from the screen the answer was for", () => {
    const saved = viewWith(["role", "targetDate", "level"]);

    expect(applyAnswer({ state: onPurpose, step: "purpose", view: saved })).toStrictEqual({
      current: "role",
      history: ["purpose"],
      view: saved,
    });
  });

  it("never moves twice for one answer saved twice", () => {
    const saved = viewWith(["role", "targetDate", "level"]);
    const once = applyAnswer({ state: onPurpose, step: "purpose", view: saved });
    const twice = applyAnswer({ state: once, step: "purpose", view: saved });

    expect(twice.current).toBe("role");
    expect(twice.history).toStrictEqual(["purpose"]);
  });

  it("goes to the plan once no question is left", () => {
    const saved = viewWith(["purpose"]);
    expect(applyAnswer({ state: onPurpose, step: "purpose", view: saved }).current).toBe("plan");
  });
});

describe("changing an earlier answer from a later screen", () => {
  const onSchedule: FlowState = {
    current: "schedule",
    history: ["purpose", "targetDate", "level"],
    view: viewWith(["schedule"]),
  };

  it("opens the earlier screen with Back returning to the later one", () => {
    const opened = openStep({ state: onSchedule, step: "targetDate" });

    expect(opened.current).toBe("targetDate");
    expect(opened.history).toStrictEqual(["purpose", "targetDate", "level", "schedule"]);
  });

  it("returns to the later screen with nothing added to Back", () => {
    const opened = openStep({ state: onSchedule, step: "targetDate" });
    const saved = viewWith(["schedule"]);

    expect(applyAnswer({ state: opened, step: "targetDate", view: saved })).toStrictEqual({
      current: "schedule",
      history: ["purpose", "targetDate", "level"],
      view: saved,
    });
  });

  it("asks a question the new answer raises before returning", () => {
    const opened = openStep({ state: onSchedule, step: "targetDate" });
    const raised = viewWith(["examChoice", "schedule"]);
    const asked = applyAnswer({ state: opened, step: "targetDate", view: raised });

    expect(asked.current).toBe("examChoice");

    const back = applyAnswer({ state: asked, step: "examChoice", view: viewWith(["schedule"]) });

    expect(back.current).toBe("schedule");
    expect(back.history).toStrictEqual(["purpose", "targetDate", "level"]);
  });
});
