import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerStudyQuestion } from "../../sessions/answer-study-question";
import { startStudyBlock } from "../../sessions/start-study-block";
import { coursePlacementSitting } from "../_test-utils/course-placement-sitting";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { loadClaimEvents } from "../_utils/load-skill-claims";
import { listKnownSkills } from "../_utils/skill-claims";
import { finishGoalPlacement } from "./finish-goal-placement";

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 0, phases: [5], userId: user.id });
  mockSession(user.id);
  const goalId = fixture.goal.id;

  let bank: Awaited<ReturnType<typeof coursePlacementSitting>>["bank"] = [];

  const finish = async () => {
    const sitting = await coursePlacementSitting(
      goalId,
      fixture.skills.map((skill) => skill.id),
      bank,
    );

    bank = sitting.bank;
    await sitting.answerAll();
    return finishGoalPlacement({ goalId, input: { attemptId: sitting.attemptId } });
  };

  return { ...fixture, finish, goalId, user };
}

describe("course placement after completion", () => {
  it("returns the lessons on the first practice miss", async () => {
    const { finish, goalId, plan, skills, user } = await setup();
    await finish();
    const skillId = skills[0]!.id;
    const where = { kind: "lesson" as const, planId: plan.id, skillId };

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "testedOut",
    });

    const item = await itemFixture({ content: choiceItemContent(), skillId });
    const session = await studySessionFixture({ goalId, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skillId] },
      sessionId: session.id,
    });

    await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });

    await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { dontKnow: true }, durationMs: 4000, itemId: item.id },
      sessionId: session.id,
    });

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "todo",
    });
  });

  it("starts after lessons filed under a topic that teach finer Library skills", async () => {
    const { finish, planItems, skills } = await setup();
    const finer = await skillFixture();

    await prisma.lessonSkill.updateMany({
      data: { skillId: finer.id },
      where: { lessonId: planItems[0]!.lessonId!, skillId: skills[0]!.id },
    });

    const finished = await finish();

    expect(finished).toMatchObject({
      completion: {
        lessonsSkipped: 4,
        result: {
          course: { chapters: [{ skipped: 4, start: true }], lessons: 5 },
          nextLesson: { id: planItems[4]!.lessonId },
        },
      },
    });
  });

  it("keeps earlier skipped items provisional after a second test", async () => {
    const { chapters, finish, goalId, plan, skills, user } = await setup();
    const first = skills[0]!.id;
    const last = skills[4]!.id;
    const chapterId = chapters[0]!.id;
    const lesson = await libraryLessonFixture({ homeChapterId: chapterId });
    await lessonSkillFixture({ lessonId: lesson.id, skillId: last });

    await planItemFixture({
      chapterId,
      lessonId: lesson.id,
      planId: plan.id,
      position: 5,
      skillId: first,
    });

    await finish();

    const known = async () =>
      listKnownSkills({
        events: await loadClaimEvents({ goalId, skillIds: [first], userId: user.id }),
      });

    const before = await known();
    expect(before.has(first)).toBe(false);
    await finish();
    const after = await known();
    expect(after.has(first)).toBe(false);
  });
});
