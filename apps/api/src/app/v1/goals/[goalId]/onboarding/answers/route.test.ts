import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as answer } from "./route";

vi.mock("@zoonk/core/view-models/onboarding/answer", () => ({ answerOnboardingQuestion: vi.fn() }));

const GOAL_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";

describe("POST /v1/goals/{goalId}/onboarding/answers", () => {
  it("says the least time a day the goals typed together need when the day asked is shorter", async () => {
    vi.mocked(answerOnboardingQuestion).mockResolvedValue({
      goals: 2,
      minutes: 10,
      status: "dayTooShort",
    });

    const response = await answer(
      new NextRequest(`http://localhost/v1/goals/${GOAL_ID}/onboarding/answers`, {
        body: JSON.stringify({ dailyMinutes: 5, question: "schedule" }),
        method: "POST",
      }),
      { params: Promise.resolve({ goalId: GOAL_ID }) },
    );

    expect(response.status).toBe(422);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DAY_TOO_SHORT", details: { goals: 2, minutes: 10 } },
    });
  });
});
