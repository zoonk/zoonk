import { planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { getCheckpointMinutes } from "../../../packages/core/src/checkpoints/checkpoint-minutes";
import { type SavedItemFacts } from "../../../packages/core/src/plans/_utils/selected-item-contract";
import { createGoalLearner } from "./checkpoint-fixtures";

const DAYS_TO_BOSS = 3;

/**
 * A phase checkpoint a few days away, with a lesson before it in its phase still to do and the next
 * phase after it: its intro says what it asks, and it opens on its day.
 */
export async function createUpcomingBoss() {
  const { goal, user } = await createGoalLearner();

  const [skill, lesson] = await Promise.all([
    skillFixture({ name: "Discounts" }),
    libraryLessonFixture({ title: "Discounts" }),
  ]);

  // Its future intro reads the ten-question offer saved by the selected plan.
  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ...Array.from({ length: 10 }, () =>
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const minutes = getCheckpointMinutes(10);

  const facts: SavedItemFacts = {
    boss: {
      kind: "text",
      minutes,
      questions: 10,
      testedKeys: [],
      testedSkillIds: [skill.id],
      waiting: false,
    },
    minutes,
    parts: { checkpoint: minutes, practice: 0, unwritten: 0, written: 0 },
    schemaVersion: 1,
    skillIds: [skill.id],
  };

  const [boss] = await Promise.all([
    planItemFixture({
      facts,
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 1,
      scheduledFor: new Date(toUTCMidnight(new Date()).getTime() + DAYS_TO_BOSS * MS_PER_DAY),
      titleSnapshot: "",
    }),
    ...[0, 1].map((phase) =>
      planItemFixture({
        kind: "lesson",
        ...(phase === 0 ? { lessonId: lesson.id, skillId: skill.id } : {}),
        phase,
        planId: plan.id,
        position: phase * 2,
        titleSnapshot: phase === 0 ? "Discounts" : "Ratios",
      }),
    ),
  ]);

  return { boss, user };
}
