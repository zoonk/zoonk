import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { listDeeperVersionTargets } from "./deeper-version-targets";

/** A written lesson with two explanations (one already deeper), a question and a draft lesson. */
async function upcomingLessons() {
  const [written, draft] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "pending" }),
  ]);

  const first = await libraryStepFixture({ lessonId: written.id, position: 0 });
  const deepened = await libraryStepFixture({ lessonId: written.id, position: 1 });

  await Promise.all([
    stepVariantFixture({ content: { text: "Deeper" }, kind: "deeper", stepId: deepened.id }),
    libraryStepFixture({ kind: "check", lessonId: written.id, position: 2 }),
    libraryStepFixture({ lessonId: draft.id, position: 0 }),
  ]);

  return { first, lessonIds: [written.id, draft.id] };
}

describe(listDeeperVersionTargets, () => {
  it("lists written explanations without a deeper version for a learner who opens it first", async () => {
    const [user, lessons] = await Promise.all([userFixture(), upcomingLessons()]);
    await learningProfileFixture({ deeperByDefault: true, userId: user.id });

    await expect(
      listDeeperVersionTargets({ lessonIds: lessons.lessonIds, userId: user.id }),
    ).resolves.toStrictEqual([{ ownerId: null, stepId: lessons.first.id }]);
  });

  it("lists the lessons the learner opens first first, whatever their ids", async () => {
    const user = await userFixture();

    const [later, sooner] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentStatus: "completed" }),
      learningProfileFixture({ deeperByDefault: true, userId: user.id }),
    ]);

    const laterSteps = await Promise.all(
      [0, 1].map((position) => libraryStepFixture({ lessonId: later.id, position })),
    );

    const soonerSteps = await Promise.all(
      [0, 1].map((position) => libraryStepFixture({ lessonId: sooner.id, position })),
    );

    const targets = await listDeeperVersionTargets({
      lessonIds: [sooner.id, later.id],
      userId: user.id,
    });

    expect(targets.map((target) => target.stepId)).toStrictEqual(
      [...soonerSteps, ...laterSteps].map((step) => step.id),
    );
  });

  it("follows memory until the learner chooses, and only while memory is on", async () => {
    const [remembered, memoryOff, choseBase, lessons] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
      upcomingLessons(),
    ]);

    await Promise.all([
      learningProfileFixture({ memoryAsksDeeper: true, userId: remembered.id }),
      learningProfileFixture({
        memoryAsksDeeper: true,
        memoryEnabled: false,
        userId: memoryOff.id,
      }),
      learningProfileFixture({
        deeperByDefault: false,
        memoryAsksDeeper: true,
        userId: choseBase.id,
      }),
    ]);

    const [fromMemory, off, base] = await Promise.all(
      [remembered, memoryOff, choseBase].map((user) =>
        listDeeperVersionTargets({ lessonIds: lessons.lessonIds, userId: user.id }),
      ),
    );

    expect(fromMemory).toHaveLength(1);
    expect(off).toStrictEqual([]);
    expect(base).toStrictEqual([]);
  });
});
