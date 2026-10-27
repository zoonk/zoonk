import { randomUUID } from "node:crypto";
import { type SectionNavigation } from "@zoonk/core/library/exams/blueprint-contract";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";

/** The exam's section asks more than the bank holds; the mock uses the bank's questions. */
export const MOCK_QUESTIONS = 6;

/** Where a fixture exam's facts come from: its notice. */
export const citation = { passage: "", sourceId: "notice" };

export const DAY_MS = 86_400_000;
export const EXAM_IN_DAYS = 60;

/** An ISO day this many days from today in UTC. */
export function isoDayFromToday(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, "yyyy-mm-dd".length);
}

/** A Cebraspe-style edition: one exam day, a wrong answer cancelling a right one. */
export function examEdition(examDay: string) {
  return {
    check: null,
    citations: [],
    dates: [{ citation, date: examDay, kind: "exam", label: "Day 1", startTime: "08:00" }],
    noticeUrl: null,
    questionCount: 12,
    sourceHash: null,
    timeZone: "America/Sao_Paulo",
    year: 2026,
  };
}

/**
 * A Plus learner's exam goal two months out, whose plan teaches one skill with the exam's own
 * questions and has this week's mock scheduled today.
 */
export async function createExamGoal(userId: string) {
  const [blueprint, skill, lesson] = await Promise.all([
    examBlueprintFixture({
      edition: examEdition(isoDayFromToday(EXAM_IN_DAYS)),
      name: "Concurso Test",
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: {
            description: "A wrong answer cancels a right one.",
            method: "wrongCancelsRight",
          },
          sections: [{ day: null, kind: "objective", minutes: 24, name: "Law", questions: 12 }],
          timeLimitMinutes: 24,
          totalQuestions: 12,
        },
        rules: [],
        subjects: [{ citation, name: "Law", questions: 12, topics: ["Statutes"], weight: 1 }],
      },
    }),
    skillFixture({ name: "Statutes" }),
    libraryLessonFixture({ title: "Statutes" }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const goal = await goalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId,
  });

  const plan = await planFixture({ goalId: goal.id, phases: [{ name: "Basics" }] });

  await Promise.all([
    ...Array.from({ length: MOCK_QUESTIONS }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: skill.id,
      }),
    ),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planItemFixture({
      kind: "lesson",
      lessonId: lesson.id,
      phase: 0,
      planId: plan.id,
      position: 0,
      titleSnapshot: lesson.title,
    }),
    planItemFixture({
      kind: "mock",
      phase: 0,
      planId: plan.id,
      position: 1,
      scheduledFor: new Date(`${isoDayFromToday(0)}T00:00:00.000Z`),
      titleSnapshot: "Mock",
    }),
  ]);

  return { blueprintId: blueprint.id, goal };
}

const BREAK_AREAS = ["Physics", "Mathematics"] as const;

/** Questions in each of the break exam's two sections, all in the exam's bank. */
export const BREAK_SECTION_QUESTIONS = 4;

/**
 * A Plus learner's exam goal whose exam day has two sections with a ten-minute break between
 * them, each with the notice's tools, and enough of the exam's questions for its full mock. With
 * `navigation`, the first section moves as it says (one question after another, say).
 */
export async function createBreakExamGoal(
  userId: string,
  { navigation = null }: { navigation?: SectionNavigation | null } = {},
) {
  const [blueprint, skills] = await Promise.all([
    examBlueprintFixture({
      name: "Break Test",
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: BREAK_AREAS.map((name, index) => ({
            breakAfterMinutes: index === 0 ? 10 : null,
            day: null,
            kind: "objective",
            minutes: 12,
            name,
            navigation: index === 0 ? navigation : null,
            questions: BREAK_SECTION_QUESTIONS,
            tools: index === 0 ? "No calculator." : "Calculator allowed.",
          })),
          timeLimitMinutes: 24,
          totalQuestions: BREAK_SECTION_QUESTIONS * BREAK_AREAS.length,
        },
        rules: [],
        subjects: BREAK_AREAS.map((name) => ({
          citation,
          name,
          questions: BREAK_SECTION_QUESTIONS,
          topics: [],
          weight: null,
        })),
      },
    }),
    Promise.all(BREAK_AREAS.map((area) => skillFixture({ name: `${area} ${randomUUID()}` }))),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill, index) => ({
        area: BREAK_AREAS[index] ?? "",
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: BREAK_SECTION_QUESTIONS }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          skillId: skill.id,
        }),
      ),
    ),
  ]);

  return { goal };
}
