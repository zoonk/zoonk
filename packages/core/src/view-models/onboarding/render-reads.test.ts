import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLessonFit } from "./get-lesson-fit";
import { getOnboardingDraft } from "./get-onboarding-draft";
import { getOnboardingResume } from "./get-onboarding-resume";

describe("onboarding supporting reads", () => {
  it("reads a saved draft without writing", async () => {
    const user = await userFixture();
    const draft = await onboardingDraftFixture({ userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getOnboardingDraft({ draftId: draft.id }));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("resumes a saved draft without writing", async () => {
    const user = await userFixture();
    await onboardingDraftFixture({ userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(getOnboardingResume);
    expect(counts.writes).toBe(0);
    expect(counts.result).toMatchObject({ resume: { kind: "draft" }, status: "ready" });
  });

  it("reads a lesson's public home chapter and course without writing", async () => {
    const { lessons, course } = await catalogCourseFixture({ lessonCounts: [2, 1] });

    const counts = await countDatabaseStatements(() =>
      getLessonFit({ lessonId: lessons[1]![0]!.id }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result?.course?.id).toBe(course.id);
  });
});
