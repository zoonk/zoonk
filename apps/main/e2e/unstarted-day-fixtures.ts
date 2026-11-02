import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";

const SHORT_ID_LENGTH = 6;
const LESSONS = 3;
const QUESTIONS_PER_SKILL = 3;

const LAST_REVIEW_DAYS_AGO = 4;
const FIRST_LESSON_DONE_DAYS_AGO = 3;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY);
}

/**
 * Titles and questions carry a tag of their own, so each test finds only its own learner's words.
 * The right option is always the first.
 */
export async function createUnstartedDay() {
  // A letter first: rich text groups a long number's digits ("775,202"), which no title search finds.
  const tag = `t${randomUUID().slice(0, SHORT_ID_LENGTH)}`;

  const [user, skills, written] = await Promise.all([
    createE2EUser(getBaseURL()),
    Promise.all(
      Array.from({ length: LESSONS }, (_, index) =>
        skillFixture({ name: `Skill ${index + 1} ${tag}` }),
      ),
    ),
    Promise.all(
      Array.from({ length: LESSONS }, (_, index) =>
        playableLessonFixture({
          lesson: { canDo: `You'll do thing ${index + 1}`, title: `Lesson ${index + 1} ${tag}` },
        }),
      ),
    ),
  ]);

  const lessons = written.map((playable) => playable.lesson);

  const goal = await goalFixture({
    dailyMinutes: 45,
    details: { placementDeclined: true },
    timezone: "UTC",
    title: `Unstarted day ${tag}`,
    userId: user.id,
  });

  const [, questions] = await Promise.all([
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? null,
        titleSnapshot: lesson.title,
        ...(index === 0 && {
          completedAt: daysAgo(FIRST_LESSON_DONE_DAYS_AGO),
          status: "done" as const,
        }),
      })),
      phases: [{ name: "Basics" }, { name: "Practice" }],
    }),
    Promise.all(
      skills.map((skill, index) =>
        Promise.all(
          Array.from({ length: QUESTIONS_PER_SKILL }, (_, question) =>
            itemFixture({
              content: choiceItemContent(`Skill ${index + 1} ${tag} question ${question + 1}?`),
              skillId: skill.id,
            }),
          ),
        ),
      ),
    ),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
  ]);

  const [firstSkill] = skills;
  const [firstQuestion] = questions[0] ?? [];

  await Promise.all([
    learnerSkillFixture({
      difficulty: 5,
      due: daysAgo(1),
      lastReviewedAt: daysAgo(LAST_REVIEW_DAYS_AGO),
      reps: 2,
      skillId: firstSkill?.id ?? "",
      stability: 3,
      state: "learning",
      userId: user.id,
    }),
    mistakeFixture({
      createdAt: daysAgo(1),
      itemId: firstQuestion?.id,
      skillId: firstSkill?.id,
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return {
    goal,
    lessons,
    reviewQuestion: new RegExp(`^Skill 1 ${tag} question \\d\\?`, "u"),
    user,
  };
}
