import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { listLearnerVersionTargets } from "./learner-version-targets";

const PYTHON = "Python (NumPy and SciPy)";

async function planWith({
  choice,
  details = {},
}: {
  choice: "have" | "none" | null;
  details?: Record<string, string>;
}) {
  const user = await userFixture();
  const goal = await goalFixture({ details, userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    settings: choice ? { tools: [{ choice, name: PYTHON }] } : {},
  });

  const chapter = await libraryChapterFixture({ tools: [{ essential: true, name: PYTHON }] });

  return { chapter, goal, plan };
}

describe(listLearnerVersionTargets, () => {
  it("lists each hands-on screen of the next written lessons in the learner's tool", async () => {
    const { chapter, goal, plan } = await planWith({ choice: "have" });
    const skill = await skillFixture();
    const item = await itemFixture({ skillId: skill.id });

    const [{ lesson, steps }, unwritten] = await Promise.all([
      playableLessonFixture({ steps: ["hook", "explanation", "workedExample", "check", "check"] }),
      libraryLessonFixture(),
    ]);

    // The worked example has its version already, and a check on an item stays as it is.
    const [, explanation, workedExample, itemCheck, plainCheck] = steps;

    await Promise.all([
      planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id, position: 0 }),
      planItemFixture({
        chapterId: chapter.id,
        lessonId: unwritten.id,
        planId: plan.id,
        position: 1,
      }),
      stepVariantFixture({
        content: {},
        key: "python",
        kind: "tool",
        stepId: workedExample?.id ?? "",
      }),
      prisma.step.update({ data: { itemId: item.id }, where: { id: itemCheck?.id } }),
    ]);

    const targets = await listLearnerVersionTargets({
      goalId: goal.id,
      lessonIds: [lesson.id, unwritten.id],
    });

    expect(targets.challenges).toStrictEqual([]);

    expect(targets.tools).toStrictEqual(
      [explanation, plainCheck].map((step) => ({
        key: "python",
        label: PYTHON,
        ownerId: null,
        stepId: step?.id,
      })),
    );
  });

  it("lists the no-install version for a learner who installs nothing", async () => {
    const { chapter, goal, plan } = await planWith({ choice: "none" });
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation"] });

    await planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id });

    const targets = await listLearnerVersionTargets({ goalId: goal.id, lessonIds: [lesson.id] });

    expect(targets.tools).toStrictEqual([
      { key: "no-install", label: "no-install", ownerId: null, stepId: steps[0]?.id },
    ]);
  });

  it("lists the chapter challenge for a learner with a field, until its version exists", async () => {
    const { goal, plan } = await planWith({
      choice: null,
      details: { field: "nursing", purpose: "work", role: "Nurse" },
    });

    const [first, second] = await Promise.all([
      playableLessonFixture({ steps: ["challenge"] }),
      playableLessonFixture({ steps: ["challenge"] }),
    ]);

    await Promise.all([
      planItemFixture({ lessonId: first.lesson.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: second.lesson.id, planId: plan.id, position: 1 }),
      stepVariantFixture({
        content: {},
        key: "nursing",
        kind: "field",
        stepId: second.steps[0]?.id ?? "",
      }),
    ]);

    const targets = await listLearnerVersionTargets({
      goalId: goal.id,
      lessonIds: [first.lesson.id, second.lesson.id],
    });

    expect(targets).toStrictEqual({
      challenges: [{ field: "nursing", ownerId: null, stepId: first.steps[0]?.id }],
      tools: [],
    });
  });

  it("lists nothing for a learner without a tool choice or a field", async () => {
    const { chapter, goal, plan } = await planWith({ choice: null });
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "challenge"] });

    await planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id });

    await expect(
      listLearnerVersionTargets({ goalId: goal.id, lessonIds: [lesson.id] }),
    ).resolves.toStrictEqual({ challenges: [], tools: [] });
  });
});
