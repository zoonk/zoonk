import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { claimGenerationQuotaIfNeeded } from "../generation-quotas/claim-generation-quota";
import { createLessonQuestionFixture } from "./_test-utils/create-question";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** A real quota database outage would also prevent fixture assertions, so only that failure boundary is replaced. */
vi.mock("../generation-quotas/claim-generation-quota", () => ({
  claimGenerationQuotaIfNeeded: vi.fn(),
}));

describe(claimLessonQuestionAnswer, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("releases its claimed revision when quota infrastructure fails", async () => {
    const { question } = await createLessonQuestionFixture();
    const quotaFailure = new Error("Quota database unavailable");
    vi.mocked(claimGenerationQuotaIfNeeded).mockRejectedValueOnce(quotaFailure);

    await expect(
      claimLessonQuestionAnswer({ questionId: question.id, requestedModel: "openai/gpt-5.6-luna" }),
    ).rejects.toBe(quotaFailure);

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({ generationRevision: 1, status: "failed" });
  });
});
