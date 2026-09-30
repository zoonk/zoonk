import { getOrCreateStepVariant } from "@zoonk/core/library/variants/get-or-create";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Writing a version is a model call covered by the variants' own tests.
vi.mock("@zoonk/core/library/variants/get-or-create", () => ({
  getOrCreateStepVariant: vi.fn(() => Promise.resolve({ status: "unsupported" })),
}));

const TIME_ZONE = "UTC";

/** A learner with a written lesson planned for tomorrow. */
async function learnerWithNextLesson(
  profile: Omit<Parameters<typeof learningProfileFixture>[0], "userId"> | null,
) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

  const [plan, lesson] = await Promise.all([
    planFixture({ goalId: goal.id }),
    libraryLessonFixture({ contentStatus: "completed" }),
    profile ? learningProfileFixture({ ...profile, userId: user.id }) : null,
  ]);

  const [step] = await Promise.all([
    libraryStepFixture({ lessonId: lesson.id }),
    planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      scheduledFor: new Date(today.getTime() + 86_400_000),
    }),
  ]);

  return { goal, step, user };
}

describe("deeper versions in session preparation", () => {
  beforeEach(() => {
    vi.mocked(getOrCreateStepVariant).mockClear();
  });

  it("writes the next lessons' deeper versions for a learner whose lessons open them first", async () => {
    const { goal, step, user } = await learnerWithNextLesson({ deeperByDefault: true });

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    expect(getOrCreateStepVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ contentScope: "shared", distinctId: user.id }),
        kind: "deeper",
        stepId: step.id,
      }),
    );
  });

  it("writes none for other learners", async () => {
    const { goal, user } = await learnerWithNextLesson(null);

    await sessionPreparationWorkflow({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

    const deeperCalls = vi
      .mocked(getOrCreateStepVariant)
      .mock.calls.filter(([input]) => input.kind === "deeper");

    expect(deeperCalls).toStrictEqual([]);
  });
});
