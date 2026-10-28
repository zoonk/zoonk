import {
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { describe, expect, it } from "vitest";
import { type FlowState, applyAnswer } from "./answered-step";

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
