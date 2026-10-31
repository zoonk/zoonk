import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLessonFit } from "./get-lesson-fit";
import { getOnboardingDraft } from "./get-onboarding-draft";
import { getOnboardingResume } from "./get-onboarding-resume";

describe("onboarding supporting read budgets", () => {
  it("reads a saved draft", async () => {
    const user = await userFixture();
    const draft = await onboardingDraftFixture({ userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getOnboardingDraft({ draftId: draft.id }));
    assertReadBudget(counts, 2);
    expect(counts.result.status).toBe("ready");
  });

  it("resumes a saved draft", async () => {
    const user = await userFixture();
    await onboardingDraftFixture({ userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(getOnboardingResume);
    assertReadBudget(counts, 4);
    expect(counts.result).toMatchObject({ resume: { kind: "draft" }, status: "ready" });
  });

  it("reads a lesson's public home chapter and course", async () => {
    const { lessons, course } = await catalogCourseFixture({ lessonCounts: [2, 1] });

    const counts = await countDatabaseStatements(() =>
      getLessonFit({ lessonId: lessons[1]![0]!.id }),
    );

    assertReadBudget(counts, 8);
    expect(counts.result?.course?.id).toBe(course.id);
  });
});
