import { type StudySessionBlock, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./_test-utils/open-today";
import { readBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const TIME_ZONE = "UTC";
const DAYS = 4;
const FIRST_DAY = Date.UTC(2026, 8, 30);

/** A life plays a lesson a day for `DAYS` days, slow under a broad run's load. */
const LIFE_TIMEOUT_MS = 60_000;

/** Noon of the life's nth day. */
function noonOf(day: number): Date {
  return new Date(FIRST_DAY + day * MS_PER_DAY + 12 * 60 * 60 * 1000);
}

/** The life's day an instant falls on. */
function dayOf(date: Date): number {
  return Math.floor((date.getTime() - FIRST_DAY) / MS_PER_DAY);
}

/**
 * Where a lesson's answers land: production's outlines tag each chapter with the plan's skill it
 * teaches, and its lessons teach finer skills of their own (`finer`); some lessons link the plan's
 * skill itself (`plan`).
 */
type LessonSkills = "finer" | "plan";

/**
 * Three plan skills of three lessons each, outlined as production writes them: a chapter tagged
 * with each plan skill holds its lessons, each lesson has a check on the skill it teaches, and the
 * bank's questions are on the plan's skills.
 */
async function outlinedLibrary(lessonSkills: LessonSkills) {
  const library = await planLibraryFixture({
    skills: [{ lessons: 3 }, { lessons: 3 }, { lessons: 3 }],
  });

  const lessonSkillLinks = await prisma.lessonSkill.findMany({
    where: { lessonId: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  const planSkillOf = new Map(lessonSkillLinks.map((link) => [link.lessonId, link.skillId]));

  await Promise.all(
    library.skills.map(async (skill, skillIndex) => {
      const chapter = await libraryChapterFixture({ title: `Chapter on ${skill.name}` });
      const lessons = library.lessons.filter((lesson) => planSkillOf.get(lesson.id) === skill.id);

      await Promise.all([
        chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
        ...lessons.map((lesson, position) =>
          chapterLessonFixture({
            chapterId: chapter.id,
            lessonId: lesson.id,
            position: skillIndex * 10 + position,
          }),
        ),
        ...Array.from({ length: 4 }, (_, index) =>
          itemFixture({ content: choiceItemContent(`${skill.name} ${index}?`), skillId: skill.id }),
        ),
      ]);
    }),
  );

  const checks = await Promise.all(
    library.lessons.map(async (lesson) => {
      const planSkillId = planSkillOf.get(lesson.id) ?? "";
      const taughtSkillId = lessonSkills === "plan" ? planSkillId : await finerSkillOf(lesson.id);

      const step = await libraryStepFixture({
        content: playableStepContent.check,
        kind: "check",
        lessonId: lesson.id,
        position: 0,
        skillId: taughtSkillId,
      });

      return [lesson.id, { planSkillId, stepId: step.id }] as const;
    }),
  );

  await prisma.lesson.updateMany({
    data: { contentStatus: "completed", specStatus: "completed" },
    where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  return { ...library, checks: new Map(checks) };
}

/** Moves a lesson onto a finer skill of its own, as lesson writing links it. */
async function finerSkillOf(lessonId: string): Promise<string> {
  const finer = await skillFixture({ name: `Finer skill of ${lessonId}` });
  await prisma.lessonSkill.updateMany({ data: { skillId: finer.id }, where: { lessonId } });
  return finer.id;
}

/** The skills a session block asks: its practice's, or its review capsules'. */
function getAskedSkillIds(block: Pick<StudySessionBlock, "id" | "payload">): string[] {
  const payload = readBlockPayload(block);
  return [...payload.skillIds, ...payload.capsules.flatMap((capsule) => capsule.skillIds)];
}

type FinishedLesson = {
  day: number;
  lessonId: string;
  /** What the end screen said: the day the lesson's topic comes back, as a life day. */
  nextReviewDay: number | null;
  planSkillId: string;
  /** What the check's result said when it was answered. */
  screenReviewDay: number | null;
};

/**
 * A learner who plays every lesson Today gives them through the lesson player, for a few days, and
 * never answers the reviews or practice. Each day reads as its blocks: a lesson by its place in
 * the library, a review or practice by the plan skills it asks.
 */
async function liveDays(lessonSkills: LessonSkills) {
  vi.setSystemTime(noonOf(0));

  const [user, library] = await Promise.all([userFixture(), outlinedLibrary(lessonSkills)]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 15,
    settings: { startDate: "2026-09-30" },
    timezone: TIME_ZONE,
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  const planSkillLabel = (skillId: string) =>
    `G${library.skills.findIndex((skill) => skill.id === skillId) + 1}`;

  const lessonLabel = (lessonId: string | null) =>
    `L${library.lessons.findIndex((lesson) => lesson.id === lessonId) + 1}`;

  const days: string[][] = [];
  const asked: string[][] = [];
  const finished: FinishedLesson[] = [];

  for (const day of Array.from({ length: DAYS }, (_, index) => index)) {
    vi.setSystemTime(noonOf(day));

    // oxlint-disable-next-line no-await-in-loop -- each day follows the one before
    const blocks = await openDay(goal.id);

    days.push(
      blocks.map((block) =>
        block.kind === "learn"
          ? lessonLabel(block.lessonId)
          : `${block.kind}[${[...new Set(getAskedSkillIds(block).map((skillId) => planSkillLabel(skillId)))].toSorted().join(",")}]`,
      ),
    );

    asked.push(blocks.flatMap((block) => (block.kind === "learn" ? [] : getAskedSkillIds(block))));

    for (const block of blocks.filter((entry) => entry.kind === "learn" && entry.lessonId)) {
      const check = library.checks.get(block.lessonId ?? "");

      // oxlint-disable-next-line no-await-in-loop -- the learner plays one lesson after another
      const played = await playLesson({
        blockId: block.id,
        lessonId: block.lessonId ?? "",
        sessionId: block.sessionId,
        stepId: check?.stepId ?? "",
      });

      finished.push({ ...played, day, planSkillId: check?.planSkillId ?? "" });
    }
  }

  return { asked, days, finished, library, userId: user.id };
}

async function openDay(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  return prisma.studySessionBlock.findMany({
    orderBy: { position: "asc" },
    where: { sessionId: today.session.id },
  });
}

/** Plays a lesson block: starts it, answers its check right and finishes it. */
async function playLesson({
  blockId,
  lessonId,
  sessionId,
  stepId,
}: {
  blockId: string;
  lessonId: string;
  sessionId: string;
  stepId: string;
}) {
  await startStudyBlock({ blockId, input: { timeZone: TIME_ZONE }, sessionId });

  const started = await startLibraryLesson({
    input: { studySessionId: sessionId, timeZone: TIME_ZONE },
    lessonId,
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started lesson, got ${started.status}`);
  }

  const checked = await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 15_000,
      runId: started.run.runId,
      timeZone: TIME_ZONE,
    },
    stepId,
  });

  vi.setSystemTime(Date.now() + 3 * 60 * 1000);

  const done = await completeLibraryLesson({
    input: { runId: started.run.runId, timeZone: TIME_ZONE },
    lessonId,
  });

  const screenReviewAt = checked.status === "checked" ? checked.result.nextReviewAt : null;
  const nextReviewAt = done.status === "completed" ? done.completion.nextReviewAt : null;

  return {
    lessonId,
    nextReviewDay: nextReviewAt ? dayOf(new Date(nextReviewAt)) : null,
    screenReviewDay: screenReviewAt ? dayOf(new Date(screenReviewAt)) : null,
  };
}

describe("a lesson whose answers land on finer skills than the plan's", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "comes back in reviews and practice on the same days as one that teaches the plan's skill",
    async () => {
      const finer = await liveDays("finer");
      const plan = await liveDays("plan");

      // The day after the first lessons opens with a review of what they taught, and practice
      // follows once the bank's questions on it weren't asked the day before.
      expect(finer.days[1]?.[0]).toMatch(/^review\[G1,G2\]$/u);
      expect(finer.days.flat().some((block) => block.startsWith("practice[G"))).toBe(true);
      expect(finer.days).toStrictEqual(plan.days);
    },
    LIFE_TIMEOUT_MS,
  );

  it(
    "brings each finished lesson's topic back on the day its end screen and its check said",
    async () => {
      const { asked, finished } = await liveDays("finer");
      const promised = finished.filter((lesson) => lesson.nextReviewDay !== null);

      expect(promised).toHaveLength(finished.length);

      expect(promised.map((lesson) => lesson.screenReviewDay)).toStrictEqual(
        promised.map((lesson) => lesson.nextReviewDay),
      );

      // The ones promised a day the life reaches: each comes back that day.
      const reached = promised.filter((lesson) => (lesson.nextReviewDay ?? DAYS) < DAYS);

      expect(reached.length).toBeGreaterThan(0);

      expect(
        reached.filter((lesson) => !asked[lesson.nextReviewDay ?? 0]?.includes(lesson.planSkillId)),
      ).toStrictEqual([]);
    },
    LIFE_TIMEOUT_MS,
  );

  it(
    "names a review after the lesson the learner finished for its topic",
    async () => {
      const finer = await liveDays("finer");
      const studied = new Set(finer.finished.map((lesson) => lesson.lessonId));

      const blocks = await prisma.studySessionBlock.findMany({
        where: { kind: "review", session: { userId: finer.userId } },
      });

      const capsules = blocks.flatMap((block) => readBlockPayload(block).capsules);

      expect(capsules.length).toBeGreaterThan(0);
      expect(capsules.every((capsule) => studied.has(capsule.lessonId ?? ""))).toBe(true);
    },
    LIFE_TIMEOUT_MS,
  );
});
