import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { moveLanguageGoalToExam } from "./move-language-goal";

describe("moved exam onboarding", () => {
  it("removes language-only Back history from an exam moved before this fix", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { answered: ["reason"], reason: "IELTS" },
      kind: "exam",
      userId: user.id,
    });

    const result = await getOnboarding({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.onboarding.goal.details.answered).not.toContain("reason");
  });

  it("does not offer a language-only reason as Back history on the moved exam", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { answered: ["reason"], reason: "IELTS" },
      kind: "language",
      targetLanguage: "en",
      userId: user.id,
    });

    const moved = await moveLanguageGoalToExam(goal.id);
    expect(moved.status).toBe("moved");

    if (moved.status !== "moved") {
      throw new Error(moved.status);
    }

    const result = await getOnboarding({ goalId: moved.goal.id });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.onboarding.steps[0]).toBe("target");
    expect(result.onboarding.goal.details.answered).not.toContain("reason");
  });
});
