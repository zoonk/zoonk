import { randomUUID } from "node:crypto";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { prisma } from "@zoonk/db";
import { type SeedCourse, writeLibraryCourse } from "@zoonk/db/seed/v2";
import { t } from "@zoonk/db/seed/v2/localize";
import { SEED_PERSONA_NAMES } from "@zoonk/db/seed/v2/personas";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  buildChapterIdentityKey,
  buildLessonIdentityKey,
  buildSkillIdentityKey,
} from "@zoonk/utils/identity-key";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadCheckpointCandidates } from "../checkpoints/_utils/checkpoint-candidates";
import { MIN_CHECKPOINT_QUESTIONS, selectCheckpointItems } from "../checkpoints/checkpoint-rules";
import { getCheckpoint } from "../checkpoints/get-checkpoint";
import { namesMatch } from "../exams/_utils/name-match";
import { findChoiceOption, findOptionAreas, readExamChoices } from "../exams/choices/exam-choices";
import { loadGoalScoreEstimate } from "../exams/estimates/load-goal-estimate";
import { loadExamHistory } from "../exams/view/_utils/exam-history";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { mistakeSnapshotSchema } from "../mistakes/mistake-snapshot";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { isPlanUnchanged } from "../plans/_utils/plan-unchanged";
import { computePlan } from "../plans/_utils/replan";
import { getPlanTimeAdvice } from "../plans/get-time-advice";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { MAX_DAILY_MINUTES, parsePlanGraph, parsePlanPhases } from "../plans/planner/plan-state";
import { seedV2, seedV2PersonaCopy } from "../seed/seed-v2";
import { followPlanChangeToday } from "../sessions/_utils/refresh-day-session";
import { parseSessionItem } from "../sessions/_utils/session-items";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { type PlannedBlock } from "../sessions/session-builder";
import { validateActivity } from "./activities/validate-activity";
import {
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "./exams/blueprint-contract";
import { isPassageInDocument } from "./exams/passage-check";
import { getPastQuestionsSource, getSubjectQuestions } from "./exams/subject-questions";
import { checkItem } from "./items/item-checks";
import { parseItemContent } from "./items/item-content";
import { STEP_CONTRACT_VERSION, parseStepContent } from "./steps/contract/step-contract";
import type * as SessionBuilder from "../sessions/session-builder";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Every day the app's session builder planned while this file ran, the seed's among them. */
const builtDays = vi.hoisted((): PlannedBlock[][] => []);

vi.mock("../sessions/session-builder", async (importOriginal) => {
  const builder = await importOriginal<typeof SessionBuilder>();

  return {
    ...builder,
    buildSessionBlocks: (input: SessionBuilder.SessionBuildInput) => {
      const day = builder.buildSessionBlocks(input);
      builtDays.push(day.blocks);
      return day;
    },
  };
});

/** Every seeded Library row carries this run id, which keeps the checks off other tests' rows. */
const SEED_RUN = "seed-v2";

const ONE_HOUR = 60;

/** ENEM questions always have five options, A to E. */
const ENEM_OPTIONS = 5;

/*
 * Near midnight, a day counted in 24-hour steps from the clock lands on the day before or after
 * once the clocks change. Maya's plan in New York runs for months, across the change: 00:30 there
 * before the clocks go back on November 1, and 23:30 before they go forward on March 14.
 */
const BEFORE_CLOCKS_GO_BACK = new Date("2026-09-30T04:30:00Z");
const BEFORE_CLOCKS_GO_FORWARD = new Date("2026-12-01T04:30:00Z");

/** Noon on a Sunday in São Paulo, the exam persona's mock day. */
const SUNDAY_IN_SAO_PAULO = new Date("2026-10-11T15:00:00Z");

/** Days of their plans `pnpm dev:persona` can put copies on: rewound to the first days, or later. */
const PERSONA_COPY_DAYS = [1, 3, 40];

/** A copy months into the longer plans, where their later phases' challenges come due. */
const LATE_COPY_DAY = 120;

/** The same words in both seed languages, for a course a test writes. */
function sameText(value: string) {
  return t(value, value);
}

/** A course for the seed's Library writer to write, in English. */
function testCourse({
  chapters,
  key,
  skills,
}: Pick<SeedCourse, "chapters" | "key" | "skills">): SeedCourse {
  return {
    category: "science",
    chapters,
    description: sameText(key),
    format: "core",
    items: [],
    key,
    languages: ["en"],
    skills,
    slug: sameText(key),
    title: sameText(key),
  };
}

/** A beginner chapter of a test course, with a lesson on each skill (see `testLessonTitle`). */
function testChapter(key: string, skills: readonly string[]): SeedCourse["chapters"][number] {
  const lessons = skills.map((skill) => ({
    description: sameText(`${key} ${skill}`),
    key: `${key}-${skill}`,
    minutes: 4,
    skills: [skill],
    title: sameText(testLessonTitle(key, skill)),
  }));

  return {
    description: sameText(key),
    key,
    lessons,
    level: "beginner",
    objectives: [],
    title: sameText(`Chapter ${key}`),
  };
}

function testLessonTitle(chapterKey: string, skill: string): string {
  return `Lesson ${chapterKey} ${skill}`;
}

function testSkill(
  key: string,
  name: string,
  prerequisites: readonly string[] = [],
): SeedCourse["skills"][number] {
  return {
    description: sameText(name),
    key,
    level: "beginner",
    name: sameText(name),
    prerequisites,
  };
}

/** What a session block holds, as a rebuild tells one day from another. */
function describeBlock({
  estimatedMinutes,
  kind,
  lessonId,
  payload,
}: Pick<PlannedBlock, "kind" | "lessonId" | "payload"> & { estimatedMinutes: number | null }) {
  return [kind, lessonId, estimatedMinutes, ...getBlockItemIds(payload)].join(":");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SeededLearners = Awaited<ReturnType<typeof seedV2>>["learners"];

let learners: SeededLearners;

function learnerIds() {
  return Object.values(learners).map((learner) => learner.userId);
}

async function countSeedRows() {
  const where = { runId: SEED_RUN };
  const learner = { userId: { in: learnerIds() } };

  const [chapters, items, lessons, skills, steps, attempts, events, mistakes, planItems] =
    await Promise.all([
      prisma.chapter.count({ where }),
      prisma.item.count({ where }),
      prisma.lesson.count({ where }),
      prisma.skill.count({ where }),
      prisma.step.count({ where }),
      prisma.attempt.count({ where: learner }),
      prisma.learningEvent.count({ where: learner }),
      prisma.mistake.count({ where: learner }),
      prisma.planItem.count({ where: { plan: { goal: learner } } }),
    ]);

  return { attempts, chapters, events, items, lessons, mistakes, planItems, skills, steps };
}

/**
 * The goals whose plan the app would write again on the day the seed wrote it: a refresh of a
 * seeded plan finds the same work at the pace it saved, so opening the app changes nothing.
 */
async function listPlansRefreshChanges(userIds = learnerIds()) {
  const goals = await prisma.goal.findMany({ where: { userId: { in: userIds } } });

  const changed = await Promise.all(
    goals.map(async (goal) => {
      const context = await loadPlanContext({ goal });

      if (!context) {
        return `${goal.title}: no plan`;
      }

      const computed = await computePlan({ context, mode: "automatic" });
      return isPlanUnchanged({ computed, context }) ? null : goal.title;
    }),
  );

  return changed.filter((title) => title !== null);
}

/** Each seeded learner's session today, their latest; the others are their past days'. */
async function loadTodaySessions(userIds = learnerIds()) {
  const sessions = await prisma.studySession.findMany({
    include: { blocks: { orderBy: { position: "asc" } } },
    orderBy: { localDate: "desc" },
    where: { userId: { in: userIds } },
  });

  return sessions.filter(
    (session, index) => sessions.findIndex((other) => other.userId === session.userId) === index,
  );
}

/** The days items are on, in order. */
function listItemDays(items: readonly { scheduledFor: Date | null }[]): string[] {
  return items
    .flatMap((item) => (item.scheduledFor ? [toIsoDate(item.scheduledFor)] : []))
    .toSorted((first, second) => first.localeCompare(second));
}

/** The learner-local date today in a goal's time zone, as `@db.Date` columns store it. */
function goalToday(goal: { timezone: string | null }): Date {
  return getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" });
}

/** A plan's items scheduled outside their phase's dates, each as `kind@day: phase start..end`. */
function listItemsOutsidePhases({
  items,
  phases,
}: {
  items: readonly { kind: string; phase: number; scheduledFor: Date | null }[];
  phases: unknown;
}) {
  const planPhases = parsePlanPhases(phases);

  return items.flatMap((item) => {
    const day = item.scheduledFor ? toIsoDate(item.scheduledFor) : "";
    const phase = planPhases[item.phase];
    const start = phase?.startDate ?? "";
    const end = phase?.endDate ?? "";
    const isInside = Boolean(start && end && day >= start && day <= end);

    return isInside ? [] : [`${item.kind}@${day}: phase ${item.phase} ${start}..${end}`];
  });
}

/** The seeded plans a refresh would change, from a seed run at another moment. */
async function listRefreshChangesSeededAt(moment: Date) {
  vi.setSystemTime(moment);
  await seedV2();
  return listPlansRefreshChanges();
}

/*
 * One file seeds once for every check: two files seeding the same rows in parallel would race on
 * their unique keys.
 */
describe("v2 seed", () => {
  beforeAll(async () => {
    // The checks plan from the day the seed ran: a run crossing a learner's midnight would compare
    // two days.
    vi.useFakeTimers({ toFake: ["Date"] });
    ({ learners } = await seedV2());
  }, 120_000);

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("library", () => {
    it("stores every step in the v2 step contract", async () => {
      const steps = await prisma.step.findMany({ where: { runId: SEED_RUN } });

      const failures = steps.flatMap((step) => {
        try {
          parseStepContent(step.kind, step.content);

          if (step.contractVersion !== STEP_CONTRACT_VERSION) {
            throw new Error(`Contract version ${step.contractVersion}`);
          }

          return [];
        } catch (error) {
          return [
            {
              error: describeError(error),
              kind: step.kind,
              lessonId: step.lessonId,
              position: step.position,
            },
          ];
        }
      });

      expect(steps.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("publishes only activities that pass validation", async () => {
      const activities = await prisma.step.findMany({
        where: { kind: "activity", runId: SEED_RUN },
      });

      const failures = activities.flatMap((step) => {
        const result = validateActivity(step.content);

        return result.ok
          ? []
          : [{ issues: result.issues, lessonId: step.lessonId, position: step.position }];
      });

      expect(activities.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("stores bank questions that pass the item checks", async () => {
      const items = await prisma.item.findMany({
        include: { examBlueprint: { select: { identityKey: true } } },
        where: { runId: SEED_RUN },
      });

      const failures = items.flatMap((item) => {
        const parsed = parseItemContent({ content: item.content, format: item.format });

        const generated = {
          ...parsed.content,
          difficulty: "medium",
          format: parsed.format,
        } as GeneratedItem;

        const problems = checkItem({
          item: generated,
          language: item.language,
          optionCount:
            item.examBlueprint?.identityKey === "enem" && item.format === "multipleChoice"
              ? ENEM_OPTIONS
              : null,
        });

        return problems.length === 0 ? [] : [{ id: item.id, problems }];
      });

      expect(items.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("cites a stored passage for every ENEM blueprint fact", async () => {
      const blueprints = await prisma.examBlueprint.findMany({
        where: { identityKey: "enem", runId: SEED_RUN },
      });

      const sources = await prisma.source.findMany({
        where: { id: { in: blueprints.flatMap((row) => row.sourceId ?? []) } },
      });

      const parsed = blueprints.map((blueprint) => ({
        edition: examEditionSchema.parse(blueprint.edition),
        structure: examStructureSchema.parse(blueprint.structure),
        topicFrequency: topicFrequencySchema.parse(blueprint.topicFrequency),
      }));

      const citations = parsed.flatMap(({ edition, structure, topicFrequency }) => [
        ...edition.citations,
        ...edition.dates.map((date) => date.citation),
        ...structure.formats.map((format) => format.citation),
        ...structure.rules.map((rule) => rule.citation),
        ...structure.subjects.map((subject) => subject.citation),
        ...(structure.mock?.citations ?? []),
        ...topicFrequency.map((entry) => entry.citation),
      ]);

      const citedSources = await prisma.source.findMany({
        where: { id: { in: citations.map((citation) => citation.sourceId) } },
      });

      const missing = citations.filter((citation) => {
        const text =
          citedSources.find((source) => source.id === citation.sourceId)?.extractedText ?? "";

        return !isPassageInDocument({ passage: citation.passage, text });
      });

      expect(blueprints.map((blueprint) => blueprint.language).toSorted()).toStrictEqual([
        "en",
        "pt",
      ]);

      expect(sources).toHaveLength(1);
      expect(missing).toStrictEqual([]);
    });

    it("describes the ENEM edition ahead, rating topics by the notice's own names", async () => {
      const blueprints = await prisma.examBlueprint.findMany({
        where: { identityKey: "enem", runId: SEED_RUN },
      });

      const parsed = blueprints.map((blueprint) => ({
        edition: examEditionSchema.parse(blueprint.edition),
        structure: examStructureSchema.parse(blueprint.structure),
        topicFrequency: topicFrequencySchema.parse(blueprint.topicFrequency),
      }));

      // The exam's last day isn't over yet and is less than a year away: never next year's
      // edition while this year's is weeks away.
      const lastDays = parsed.map(
        ({ edition }) =>
          new Date(
            `${edition.dates.findLast((date) => date.kind === "exam")?.date}T23:59:59-03:00`,
          ),
      );

      expect(lastDays.every((day) => day.getTime() >= Date.now())).toBe(true);

      expect(lastDays.every((day) => day.getTime() - Date.now() < 366 * 24 * 60 * 60 * 1000)).toBe(
        true,
      );

      const unnamed = parsed.flatMap(({ structure, topicFrequency }) =>
        topicFrequency
          .filter((entry) =>
            structure.subjects.every((subject) => !subject.topics.includes(entry.topic)),
          )
          .map((entry) => entry.topic),
      );

      expect(unnamed).toStrictEqual([]);
    });

    it("names each ENEM area once", async () => {
      const blueprints = await prisma.examBlueprint.findMany({
        where: { identityKey: "enem", runId: SEED_RUN },
      });

      const repeated = blueprints.flatMap((blueprint) => {
        const names = examStructureSchema
          .parse(blueprint.structure)
          .subjects.map((subject) => subject.name);

        return names.filter((name, index) => names.indexOf(name) !== index);
      });

      expect(blueprints).toHaveLength(2);
      expect(repeated).toStrictEqual([]);
    });

    it("offers ENEM's foreign language as a choice inside Linguagens, counted by the latest edition", async () => {
      const blueprint = await prisma.examBlueprint.findFirstOrThrow({
        where: { identityKey: "enem", language: "pt", runId: SEED_RUN },
      });

      const structure = examStructureSchema.parse(blueprint.structure);

      const options = structure.subjects
        .filter((subject) => subject.choiceGroup)
        .map((subject) => ({
          choiceGroup: subject.choiceGroup,
          name: subject.name,
          partOf: subject.partOf,
          questions: getSubjectQuestions({ structure, subject }),
        }));

      const languages = "Linguagens, Códigos e suas Tecnologias";

      expect(options).toStrictEqual([
        {
          choiceGroup: "Língua Estrangeira",
          name: "Língua Inglesa",
          partOf: languages,
          questions: 5,
        },
        {
          choiceGroup: "Língua Estrangeira",
          name: "Língua Espanhola",
          partOf: languages,
          questions: 5,
        },
      ]);

      // The notice doesn't count them: the latest edition's answer key does, cited.
      expect(
        structure.subjects.flatMap((subject) => (subject.choiceGroup ? [subject.questions] : [])),
      ).toStrictEqual([null, null]);

      expect(getPastQuestionsSource(structure)).toMatchObject({
        edition: "Enem 2025",
        url: expect.stringContaining("inep.gov.br"),
      });
    });

    it("builds identity keys the way identity search does", async () => {
      const [chapters, lessons, skills] = await Promise.all([
        prisma.chapter.findMany({ where: { runId: SEED_RUN } }),
        prisma.lesson.findMany({
          include: { homeChapter: { select: { homeCourseId: true } }, skills: true },
          where: { runId: SEED_RUN },
        }),
        prisma.skill.findMany({ where: { runId: SEED_RUN } }),
      ]);

      const mismatches = [
        ...chapters.filter(
          (chapter) =>
            chapter.identityKey !==
            buildChapterIdentityKey({ ...chapter, courseId: chapter.homeCourseId }),
        ),
        ...lessons.filter(
          (lesson) =>
            lesson.identityKey !==
            buildLessonIdentityKey({
              courseId: lesson.homeChapter?.homeCourseId ?? null,
              level: lesson.level,
              skillIds: lesson.skills.map((row) => row.skillId),
              targetLanguage: lesson.targetLanguage,
            }),
        ),
        ...skills.filter((skill) => skill.identityKey !== buildSkillIdentityKey(skill)),
      ].map((row) => row.identityKey);

      expect(mismatches).toStrictEqual([]);
    });

    it("gives every written lesson a summary card and every outline lesson its skills", async () => {
      // Rows, not `_count`: Prisma counts a relation over its whole table, and the test database
      // keeps every run's rows.
      const lessons = await prisma.lesson.findMany({
        select: {
          skills: { select: { skillId: true } },
          steps: { select: { id: true } },
          summary: true,
          title: true,
        },
        where: { runId: SEED_RUN },
      });

      const written = lessons.filter((lesson) => lesson.steps.length > 0);

      expect(written.length).toBeGreaterThan(0);

      expect(
        written.filter((lesson) => lesson.summary === null).map((lesson) => lesson.title),
      ).toStrictEqual([]);

      expect(
        lessons.filter((lesson) => lesson.skills.length === 0).map((lesson) => lesson.title),
      ).toStrictEqual([]);
    });

    it("runs again without duplicating anything", async () => {
      const before = await countSeedRows();

      await seedV2();

      await expect(countSeedRows()).resolves.toStrictEqual(before);
    }, 120_000);

    /*
     * On a database learners have used, the app may already hold a skill under a seeded skill's
     * name (the ENEM skills come from a real goal's graph). Identity search keeps one skill per
     * name, so the seed points its course at the app's skill, leaves it as it was, and runs again.
     */
    it("points a course at a skill the app already wrote under the same name, again and again", async () => {
      const key = `skills-${randomUUID().slice(0, 8)}`;
      const name = `${key} motion graphs`;
      const nextName = `${key} speed`;
      const chapter = testChapter(`${key}-motion`, ["graphs"]);

      const [appSkill, organization] = await Promise.all([
        skillFixture({ identityKey: buildSkillIdentityKey({ name, targetLanguage: null }), name }),
        organizationFixture(),
      ]);

      const course = testCourse({
        chapters: [chapter],
        key,
        skills: [testSkill("graphs", name), testSkill("speed", nextName, ["graphs"])],
      });

      await writeLibraryCourse({ course, organizationId: organization.id, prisma });
      await writeLibraryCourse({ course, organizationId: organization.id, prisma });

      const [lesson, next, sameName] = await Promise.all([
        prisma.lesson.findFirstOrThrow({
          include: { skills: true },
          where: { title: testLessonTitle(chapter.key, "graphs") },
        }),
        prisma.skill.findFirstOrThrow({
          include: { prerequisites: true },
          where: { name: nextName },
        }),
        prisma.skill.findMany({ where: { name } }),
      ]);

      expect(lesson.skills.map((row) => row.skillId)).toStrictEqual([appSkill.id]);
      expect(next.prerequisites.map((row) => row.prerequisiteId)).toStrictEqual([appSkill.id]);
      expect(sameName).toStrictEqual([appSkill]);
    });

    /*
     * The app adds its own chapters to a seeded course in teaching order, and a split lesson right
     * after the one it came from, renumbering the rest. The seed keeps those places and puts what
     * it adds where its own position is free, or at the end.
     */
    it("keeps the chapters and lessons the app placed in a seeded course, and adds new ones after them", async () => {
      const key = `outline-${randomUUID().slice(0, 8)}`;
      const skills = ["a", "b", "c", "d"].map((skill) => testSkill(skill, `${key} ${skill}`));
      const first = testChapter(`${key}-1`, ["a"]);
      const second = testChapter(`${key}-2`, ["b"]);
      const third = testChapter(`${key}-3`, ["c"]);
      const organization = await organizationFixture();

      const write = (chapters: SeedCourse["chapters"]) =>
        writeLibraryCourse({
          course: testCourse({ chapters, key, skills }),
          organizationId: organization.id,
          prisma,
        });

      await write([first, second]);

      const [course, firstRow, secondRow, appChapter, appLesson] = await Promise.all([
        prisma.course.findFirstOrThrow({ where: { organizationId: organization.id, slug: key } }),
        prisma.chapter.findFirstOrThrow({ where: { title: `Chapter ${first.key}` } }),
        prisma.chapter.findFirstOrThrow({ where: { title: `Chapter ${second.key}` } }),
        libraryChapterFixture(),
        libraryLessonFixture(),
      ]);

      // The app continues the first chapter with one of its own, and splits its lesson in two.
      await prisma.courseChapter.update({
        data: { position: 2 },
        where: { courseId_chapterId: { chapterId: secondRow.id, courseId: course.id } },
      });

      await Promise.all([
        courseChapterFixture({ chapterId: appChapter.id, courseId: course.id, position: 1 }),
        chapterLessonFixture({ chapterId: firstRow.id, lessonId: appLesson.id, position: 1 }),
      ]);

      // The seed then adds a chapter, and a lesson to the first chapter.
      const firstWithMore = testChapter(first.key, ["a", "d"]);

      await write([firstWithMore, second, third]);
      await write([firstWithMore, second, third]);

      const [outline, firstLessons] = await Promise.all([
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          select: { chapter: { select: { title: true } }, position: true },
          where: { courseId: course.id },
        }),
        prisma.chapterLesson.findMany({
          orderBy: { position: "asc" },
          select: { lesson: { select: { title: true } }, position: true },
          where: { chapterId: firstRow.id },
        }),
      ]);

      expect(outline.map((row) => [row.position, row.chapter.title])).toStrictEqual([
        [0, `Chapter ${first.key}`],
        [1, appChapter.title],
        [2, `Chapter ${second.key}`],
        [3, `Chapter ${third.key}`],
      ]);

      expect(firstLessons.map((row) => [row.position, row.lesson.title])).toStrictEqual([
        [0, testLessonTitle(first.key, "a")],
        [1, appLesson.title],
        [2, testLessonTitle(first.key, "d")],
      ]);
    });

    /*
     * A learner reaching a seeded outline lesson has the app write it, at a cost. Seeding again
     * keeps that lesson as the app wrote it, so nothing is paid for twice.
     */
    it("keeps a lesson the app wrote when it seeds again", async () => {
      const key = `content-${randomUUID().slice(0, 8)}`;
      const chapter = testChapter(`${key}-1`, ["a", "b"]);
      const organization = await organizationFixture();

      const course = testCourse({
        chapters: [chapter],
        key,
        skills: ["a", "b"].map((skill) => testSkill(skill, `${key} ${skill}`)),
      });

      await writeLibraryCourse({ course, organizationId: organization.id, prisma });

      const [written, untouched] = await Promise.all([
        prisma.lesson.findFirstOrThrow({ where: { title: testLessonTitle(chapter.key, "a") } }),
        prisma.lesson.findFirstOrThrow({ where: { title: testLessonTitle(chapter.key, "b") } }),
      ]);

      const step = await libraryStepFixture({ lessonId: written.id, position: 0 });

      await prisma.lesson.update({
        data: {
          canDo: "You can read a motion graph.",
          contentStatus: "completed",
          specStatus: "completed",
        },
        where: { id: written.id },
      });

      await writeLibraryCourse({ course, organizationId: organization.id, prisma });

      const lessons = await prisma.lesson.findMany({
        orderBy: { title: "asc" },
        select: { canDo: true, contentStatus: true, specStatus: true, steps: true },
        where: { id: { in: [written.id, untouched.id] } },
      });

      expect(lessons).toStrictEqual([
        {
          canDo: "You can read a motion graph.",
          contentStatus: "completed",
          specStatus: "completed",
          steps: [step],
        },
        { canDo: null, contentStatus: "pending", specStatus: "pending", steps: [] },
      ]);
    });
  });

  describe("learners", () => {
    it("stores plans the planner can read: phases with dates, the skill graph and changes", async () => {
      const plans = await prisma.plan.findMany({
        include: { changes: true },
        where: { goal: { userId: { in: learnerIds() } } },
      });

      const unreadable = plans.filter(
        (plan) =>
          !Array.isArray(plan.phases) ||
          parsePlanPhases(plan.phases).length !== plan.phases.length ||
          parsePlanGraph(plan.graph).skills.length === 0,
      );

      const changes = plans.flatMap((plan) => plan.changes);
      const edits = changes.filter((change) => change.kind === "edited");

      expect(plans).toHaveLength(Object.keys(learners).length);
      expect(unreadable.map((plan) => plan.goalId)).toStrictEqual([]);

      expect(
        edits.filter((change) => parsePlanChangePayload(change.payload).operations.length === 0),
      ).toStrictEqual([]);

      expect(changes.some((change) => change.status === "proposed")).toBe(true);
    });

    it("keeps every exam plan item inside its phase's dates", async () => {
      const plans = await prisma.plan.findMany({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goal: { kind: "exam", userId: { in: learnerIds() } } },
      });

      expect(plans.length).toBeGreaterThan(0);
      expect(plans.flatMap((plan) => listItemsOutsidePhases(plan))).toStrictEqual([]);
    });

    /*
     * The seed stores the plan the planner makes: opening the app on the seeded day, a refresh
     * finds the same work, graph and settings, so Today and the plan screen show what was seeded.
     */
    it("stores the plan a refresh keeps", async () => {
      await expect(listPlansRefreshChanges()).resolves.toStrictEqual([]);
    });

    /*
     * Onboarding's time question and the plan editor advise the time a day the whole exam needs.
     * Ana's ENEM graph has a real one's skills and sizes (about 3,800 lessons), so she's advised
     * what a real ENEM goal needs: more than an hour a day with the exam months away, and no time
     * that covers it all when it's closer. A graph of the course's own 21 skills advised 5 minutes.
     */
    it("advises the exam persona the time a real ENEM goal needs", async () => {
      mockSession(learners.exam.userId);

      const result = await getPlanTimeAdvice({ goalId: learners.exam.goalId, input: {} });
      const advice = result.status === "ready" ? result.advice : null;

      expect(advice?.ready).toBe(true);
      expect(advice?.recommendedMinutes ?? MAX_DAILY_MINUTES).toBeGreaterThan(ONE_HOUR);
    });

    /*
     * A plan change reads a topic as in the plan by its items' skills: a seeded lesson without the
     * skill the planner counts it for made a persona's missed-days card say its own lessons'
     * topics now fit.
     */
    it("gives every lesson on a plan the skill it counts for", async () => {
      const lessons = await prisma.planItem.findMany({
        where: { kind: "lesson", plan: { goal: { userId: { in: learnerIds() } } }, skillId: null },
      });

      expect(lessons.map((item) => item.titleSnapshot)).toStrictEqual([]);
    });

    /*
     * `pnpm dev:persona` writes copies on other days of their plans, rewound to the first days or
     * later. Both checks below read the same copies, so they're written once.
     */
    describe("copies on other days of their plans", () => {
      let copies: Awaited<ReturnType<typeof seedV2PersonaCopy>>[];

      beforeAll(async () => {
        copies = await Promise.all(
          PERSONA_COPY_DAYS.flatMap((day) =>
            SEED_PERSONA_NAMES.map((persona) =>
              seedV2PersonaCopy({
                copyKey: `day-${day}`,
                day,
                email: `seed-copy-${persona}-day-${day}@zoonk.test`,
                persona,
              }),
            ),
          ),
        );
      }, 120_000);

      // A plan rewound to its first days or started earlier is the planner's too, with exam items
      // in their windows.
      it("stores the plan a refresh keeps for a copy on another day of its plan", async () => {
        const userIds = copies.map((copy) => copy.userId);

        const examPlans = await prisma.plan.findMany({
          include: { items: { orderBy: { position: "asc" } } },
          where: { goal: { kind: "exam", userId: { in: userIds } } },
        });

        await expect(listPlansRefreshChanges(userIds)).resolves.toStrictEqual([]);
        expect(examPlans).toHaveLength(PERSONA_COPY_DAYS.length);
        expect(examPlans.flatMap((plan) => listItemsOutsidePhases(plan))).toStrictEqual([]);
      }, 120_000);

      /*
       * A phase challenge waits silently while its phase's skills hold fewer questions than it
       * needs, so every challenge a persona or a `pnpm dev:persona` copy reaches has enough in the
       * bank. A language goal's challenge is a call (so the late copies skip the language persona),
       * and a phase whose skills all start in another phase has none to ask.
       */
      it("has the questions for every phase challenge a seeded learner reaches", async () => {
        const lateCopies = await Promise.all(
          SEED_PERSONA_NAMES.filter((persona) => persona !== "language").map((persona) =>
            seedV2PersonaCopy({
              copyKey: `bank-${LATE_COPY_DAY}`,
              day: LATE_COPY_DAY,
              email: `seed-bank-${persona}-day-${LATE_COPY_DAY}@zoonk.test`,
              persona,
            }),
          ),
        );

        const copyIds = [...copies, ...lateCopies].map((copy) => copy.userId);

        const goals = await prisma.goal.findMany({
          where: { kind: { not: "language" }, userId: { in: [...learnerIds(), ...copyIds] } },
        });

        const short = await Promise.all(
          goals.map(async (goal) => {
            const plan = await loadGoalPlan(goal.id);

            const bosses = await prisma.planItem.findMany({
              where: { kind: "boss", plan: { goalId: goal.id }, status: "todo" },
            });

            const counts = await Promise.all(
              bosses.map(async (boss) => {
                const skillIds = plan.skills
                  .filter((skill) => skill.phase === boss.phase)
                  .map((skill) => skill.id);

                const candidates = await loadCheckpointCandidates({
                  examBlueprintId: goal.examBlueprintId,
                  skillIds,
                  userId: goal.userId,
                });

                const asked = selectCheckpointItems({ candidates, skillIds }).length;

                return skillIds.length === 0 || asked >= MIN_CHECKPOINT_QUESTIONS
                  ? []
                  : [`${goal.title} phase ${boss.phase}: ${asked} questions`];
              }),
            );

            return counts.flat();
          }),
        );

        expect(goals.length).toBeGreaterThan(copyIds.length);
        expect(short.flat()).toStrictEqual([]);
      }, 120_000);
    });

    /*
     * A plan its date leaves short of time stops where the time runs out (Marcos covers part of
     * the way to B1+ by his move), so only the phases of plans that fit close with their challenge.
     */
    it("closes each phase with a phase checkpoint, never a weekly challenge or a practice day", async () => {
      const bosses = await prisma.planItem.findMany({
        where: {
          kind: "boss",
          plan: { goal: { kind: { not: "exam" }, userId: { in: learnerIds() } } },
        },
      });

      const plans = await prisma.plan.findMany({
        include: { items: { orderBy: { position: "asc" } } },
        where: {
          OR: [{ coveredShare: null }, { coveredShare: { gte: 1 } }],
          goal: { kind: { in: ["learn", "language"] }, userId: { in: learnerIds() } },
        },
      });

      const missing = plans.flatMap((plan) =>
        parsePlanPhases(plan.phases).flatMap((phase, index) => {
          // The weekly challenges and the practice days after the last lesson come after it.
          const last = plan.items.findLast(
            (item) => item.phase === index && item.kind !== "checkpoint" && item.kind !== "review",
          );

          return last?.kind === "boss" ? [] : [`${plan.goalId}: ${phase.name}`];
        }),
      );

      expect(bosses.length).toBeGreaterThan(0);
      expect(missing).toStrictEqual([]);
    });

    /*
     * The app rebuilds a learner's session for the day with blocks of its own, which hold the
     * positions the seeded blocks take, so running the seed again puts the seeded blocks back.
     */
    it("writes today's session again over blocks the app built into it", async () => {
      const copy = {
        copyKey: "app-blocks",
        email: "seed-copy-exam-app-blocks@zoonk.test",
        persona: "exam",
      } as const;

      const { goalId } = await seedV2PersonaCopy(copy);

      const loadToday = () =>
        prisma.studySession.findFirstOrThrow({
          orderBy: { localDate: "desc" },
          select: {
            blocks: {
              orderBy: { position: "asc" },
              select: { id: true, kind: true, position: true },
            },
            id: true,
          },
          where: { goalId },
        });

      const seeded = await loadToday();

      await prisma.studySessionBlock.deleteMany({ where: { sessionId: seeded.id } });

      await prisma.studySessionBlock.create({
        data: { kind: "review", position: 0, sessionId: seeded.id },
      });

      await seedV2PersonaCopy(copy);

      await expect(loadToday()).resolves.toStrictEqual(seeded);
    }, 120_000);

    // A walk on a shared persona left a plan change that every later walk was told about.
    it("drops the plan changes the app made to a persona when it seeds again", async () => {
      const copy = {
        copyKey: "app-change",
        email: "seed-copy-language-app-change@zoonk.test",
        persona: "language",
      } as const;

      const { goalId } = await seedV2PersonaCopy(copy);
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

      const change = await prisma.planChange.create({
        data: { kind: "missedDays", planId: plan.id, reason: "The app moved the plan." },
      });

      await seedV2PersonaCopy(copy);

      await expect(prisma.planChange.findUnique({ where: { id: change.id } })).resolves.toBeNull();
    }, 120_000);

    /*
     * A seeded day the session builder wouldn't make (Marcos: 3 blocks where it makes 6) turned
     * into the builder's on the first rebuild, so any plan change looked like it changed today.
     */
    it("writes the day the app's session builder plans, with how far the persona got", async () => {
      const sessions = await loadTodaySessions();

      const planned = new Set(
        builtDays.map((blocks) => blocks.map((block) => describeBlock(block)).join(" | ")),
      );

      const unplanned = sessions.flatMap((session) => {
        const day = session.blocks.map((block) =>
          describeBlock({ ...block, payload: readBlockPayload(block) }),
        );

        return planned.has(day.join(" | ")) ? [] : [day];
      });

      expect(sessions.length).toBeGreaterThan(0);
      expect(unplanned).toStrictEqual([]);

      // The personas got part of the way: none finished nothing, so each day shows its progress.
      expect(
        sessions.filter((session) => session.blocks.every((block) => block.status === "pending")),
      ).toStrictEqual([]);
    });

    /*
     * Lucas started today's lesson, then made a change that didn't touch today: the rest of his day
     * came back rebuilt, practice taking its share of what was left, so a second lesson came in and
     * practice lost half its questions. Ana's got one lesson more and two questions less.
     */
    it("keeps the rest of a started day as it was when a plan change leaves today alone", async () => {
      const copies = await Promise.all(
        SEED_PERSONA_NAMES.map(async (persona) => ({
          persona,
          ...(await seedV2PersonaCopy({
            copyKey: "started-day",
            email: `seed-copy-${persona}-started-day@zoonk.test`,
            persona,
          })),
        })),
      );

      const results = await Promise.all(
        copies.map(async ({ goalId, persona, userId }) => {
          const [goal, session] = await Promise.all([
            prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
            prisma.studySession.findFirst({ orderBy: { localDate: "desc" }, where: { goalId } }),
          ]);

          const refresh = session
            ? await followPlanChangeToday({
                goalId,
                localDate: session.localDate,
                timeZone: getAnswerTimeZone({ goal }),
                userId,
              })
            : "notBuilt";

          return [persona, refresh];
        }),
      );

      expect(results.filter(([, refresh]) => refresh === "rebuilt")).toStrictEqual([]);
      expect(results.some(([, refresh]) => refresh === "same")).toBe(true);
    }, 120_000);

    /*
     * The week's days, a boss's result and a mock's sitting read a learner's past sessions: a
     * persona with history but no sessions showed an empty week and a won boss with no result.
     */
    it("writes a finished session for every past day the history counts, a block for each of its rows", async () => {
      const goals = await prisma.goal.findMany({ where: { userId: { in: learnerIds() } } });

      const gaps = await Promise.all(
        goals.map(async (goal) => {
          const today = goalToday(goal);

          const [events, sessions] = await Promise.all([
            prisma.learningEvent.findMany({
              where: { localDate: { lt: today }, userId: goal.userId },
            }),
            prisma.studySession.findMany({
              include: { blocks: { where: { status: "completed" } } },
              where: { goalId: goal.id, localDate: { lt: today }, status: "completed" },
            }),
          ]);

          const rows = Map.groupBy(events, (event) => toIsoDate(event.localDate));

          const blocks = new Map(
            sessions.map((session) => [toIsoDate(session.localDate), session.blocks.length]),
          );

          return [...rows].flatMap(([day, dayRows]) =>
            blocks.get(day) === dayRows.length ? [] : [`${goal.title} ${day}`],
          );
        }),
      );

      expect(goals.length).toBeGreaterThan(0);
      expect(gaps.flat()).toStrictEqual([]);
    });

    // Lucas's bosses showed "won" on his Journey and opened to the pre-game card, with no result.
    it("shows each boss a persona fought with the result its history gives", async () => {
      const { userId } = learners.buddy;

      const [blocks, rows] = await Promise.all([
        prisma.studySessionBlock.findMany({
          orderBy: { startedAt: "asc" },
          where: { kind: "checkpoint", session: { status: "completed", userId } },
        }),
        prisma.learningEvent.findMany({
          orderBy: { endedAt: "asc" },
          where: { kind: "checkpoint", userId },
        }),
      ]);

      mockSession(userId);

      const results = await Promise.all(
        blocks.map(async (block) => {
          const found = await getCheckpoint(block.id);
          return found.status === "ready" ? found.checkpoint.result : null;
        }),
      );

      expect(rows.length).toBeGreaterThan(0);

      expect(results.map((result) => result && [result.correct, result.total])).toStrictEqual(
        rows.map((row) => [row.correctAnswers, row.correctAnswers + row.incorrectAnswers]),
      );
    });

    // Ana's exam page had no mocks while her preparation, which reads the ledger, cited one.
    it("gives the exam persona's mocks a finished sitting the exam page shows, as the ledger counts it", async () => {
      const { goalId, userId } = learners.exam;
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

      const [history, rows] = await Promise.all([
        loadExamHistory({ goalId, today: goalToday(goal) }),
        prisma.learningEvent.findMany({
          orderBy: { endedAt: "desc" },
          where: { kind: "mock", userId },
        }),
      ]);

      expect(rows.length).toBeGreaterThan(0);

      expect(history.mocks.map((mock) => [mock.correct, mock.total])).toStrictEqual(
        rows.map((row) => [row.correctAnswers, row.correctAnswers + row.incorrectAnswers]),
      );

      expect(history.mocks.filter((mock) => mock.blockId === null)).toStrictEqual([]);
    });

    // Ana's first mock asked the six questions the bank had for its exam day, too few for an
    // estimate, so her preparation showed no score after it.
    it("gives the exam persona's first mock enough questions for a score on the exam's scale", async () => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: learners.exam.goalId } });
      const estimate = await loadGoalScoreEstimate({ goal, ledgerMocks: [] });

      expect(estimate?.scale).toBe("irt");
    });

    /*
     * Ana's next mock was seeded on next Sunday, off the planner's days for her 45 minutes a day
     * (a mock every four weeks), so the first change that planned her days again moved it.
     */
    it("puts the exam persona's next mocks on the days her plan made again keeps", async () => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: learners.exam.goalId } });
      const context = await loadPlanContext({ goal });

      const stored = await prisma.planItem.findMany({
        orderBy: { scheduledFor: "asc" },
        where: { kind: "mock", plan: { goalId: goal.id }, status: "todo" },
      });

      const computed = context ? await computePlan({ context, mode: "forced" }) : null;

      const replanned = (computed?.built.items ?? []).filter(
        (item) => item.kind === "mock" && item.status === "todo",
      );

      expect(stored.length).toBeGreaterThan(0);
      expect(listItemDays(replanned)).toStrictEqual(listItemDays(stored));
    });

    // The Journey asked the seeded ENEM learner which foreign language she takes on every visit.
    it("picks the exam persona's foreign language, an option of her exam that her graph teaches", async () => {
      const goal = await prisma.goal.findUniqueOrThrow({
        include: { examBlueprint: true, plan: true },
        where: { id: learners.exam.goalId },
      });

      const structure = examStructureSchema.parse(goal.examBlueprint?.structure);
      const choices = readExamChoices(goal.plan?.settings);

      const taught = findOptionAreas({
        areas: parsePlanGraph(goal.plan?.graph).skills.flatMap((skill) => skill.area ?? []),
        structure,
      });

      expect(choices.length).toBeGreaterThan(0);

      expect(choices.filter((choice) => !findChoiceOption({ choice, structure }))).toStrictEqual(
        [],
      );

      expect(
        choices.filter((choice) => ![...taught.values()].includes(choice.subject)),
      ).toStrictEqual([]);
    });

    // Lucas had six lessons done and two answers in all.
    it("has answers in every lesson the buddy persona finished, on the day he finished it", async () => {
      const { goalId, userId } = learners.buddy;

      const [lessons, attempts] = await Promise.all([
        prisma.planItem.findMany({
          include: { lesson: { include: { skills: true } } },
          where: { kind: "lesson", plan: { goalId }, status: "done" },
        }),
        prisma.attempt.findMany({ where: { userId } }),
      ]);

      const answered = new Set(
        attempts.map((attempt) => `${attempt.skillId}:${toIsoDate(attempt.localDate)}`),
      );

      const unanswered = lessons.filter((item) => {
        const day = item.scheduledFor ? toIsoDate(item.scheduledFor) : null;
        return !item.lesson?.skills.some((skill) => answered.has(`${skill.skillId}:${day}`));
      });

      expect(lessons.length).toBeGreaterThan(0);
      expect(unanswered.map((item) => item.titleSnapshot)).toStrictEqual([]);
    });

    it("builds today's blocks in the session payload shape, asking only questions sessions grade", async () => {
      const today = await loadTodaySessions();

      const blocks = await prisma.studySessionBlock.findMany({
        where: {
          kind: { in: ["practice", "review"] },
          sessionId: { in: today.map((session) => session.id) },
        },
      });

      const itemIds = blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block)));
      const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });

      expect(
        blocks.filter((block) => getBlockItemIds(readBlockPayload(block)).length === 0),
      ).toStrictEqual([]);

      expect(items).toHaveLength(new Set(itemIds).size);

      expect(
        items.filter((item) => parseSessionItem(item) === null).map((item) => item.id),
      ).toStrictEqual([]);
    });

    it("gives every learner an active goal with a plan, today's session, skills and history", async () => {
      // Rows, not `_count`: Prisma counts a relation over its whole table, and the test database
      // keeps every run's rows.
      const users = await prisma.user.findMany({
        select: {
          email: true,
          goals: { select: { id: true, plan: { select: { items: { select: { id: true } } } } } },
          isAnonymous: true,
          learnerSkills: { select: { id: true } },
          learningEvents: { select: { id: true } },
          learningProfile: { select: { activeGoalId: true } },
          studySessions: {
            orderBy: { localDate: "desc" },
            select: { blocks: { select: { id: true } } },
            take: 1,
          },
        },
        where: { id: { in: learnerIds() } },
      });

      expect(users).toHaveLength(Object.keys(learners).length);

      const gaps = users.flatMap((user) => {
        const goal = user.goals[0];

        return [
          user.learningProfile?.activeGoalId !== goal?.id && `${user.email}: active goal`,
          !goal?.plan?.items.length && `${user.email}: plan items`,
          // The guest finished a public lesson before making a goal, and hasn't opened Today.
          user.isAnonymous || user.studySessions[0]?.blocks.length
            ? null
            : `${user.email}: today's session`,
          user.learnerSkills.length === 0 && `${user.email}: skills`,
          user.learningEvents.length === 0 && `${user.email}: history`,
        ].filter((gap) => typeof gap === "string");
      });

      expect(gaps).toStrictEqual([]);
    });

    it("covers every goal kind", async () => {
      const goals = await prisma.goal.findMany({ where: { userId: { in: learnerIds() } } });

      expect(new Set(goals.map((goal) => goal.kind))).toStrictEqual(
        new Set(["explain", "exam", "language", "learn"]),
      );

      expect(goals.find((goal) => goal.kind === "exam")?.targetDate).not.toBeNull();
    });

    it("links every plan to Library skills that placement and preparation can read", async () => {
      const plans = await Promise.all(
        Object.values(learners).map((learner) => loadGoalPlan(learner.goalId)),
      );

      expect(plans.filter((plan) => plan.skills.length === 0)).toStrictEqual([]);
    });

    /*
     * Mocks group their scores by the plan's area of each question's skill, falling back to the
     * exam day's name, so a bank question outside the plan's areas shows up as a made-up area. A
     * subject counted inside another (ENEM's foreign language, inside Linguagens) isn't an area.
     */
    it("puts every exam bank question in a plan area that names one of the exam's areas", async () => {
      const goal = await prisma.goal.findUniqueOrThrow({
        include: { examBlueprint: true, plan: true },
        where: { id: learners.exam.goalId },
      });

      const items = await prisma.item.findMany({
        where: { examBlueprintId: goal.examBlueprintId },
      });

      const subjects = examStructureSchema
        .parse(goal.examBlueprint?.structure)
        .subjects.filter((subject) => !subject.partOf);

      const areas = new Map(
        parsePlanGraph(goal.plan?.graph).skills.map((skill) => [skill.skillId, skill.area]),
      );

      const outside = items.filter((item) => {
        const area = areas.get(item.skillId);
        return !area || subjects.filter((subject) => namesMatch(area, subject.name)).length !== 1;
      });

      expect(items.length).toBeGreaterThan(0);
      expect(outside.map((item) => item.id)).toStrictEqual([]);
    });

    it("keeps a readable snapshot for every mistake in the notebook", async () => {
      const mistakes = await prisma.mistake.findMany({ where: { userId: { in: learnerIds() } } });

      expect(mistakes.length).toBeGreaterThan(0);

      expect(
        mistakes.filter((mistake) => !mistakeSnapshotSchema.safeParse(mistake.snapshot).success),
      ).toStrictEqual([]);

      expect(mistakes.filter((mistake) => mistake.attemptId === null)).toStrictEqual([]);
    });

    it("seeds a grown buddy, a learner with a daily limit and an anonymous guest", async () => {
      const [buddy, stocks, guest] = await Promise.all([
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learners.buddy.userId } }),
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learners.stocks.userId } }),
        prisma.user.findUniqueOrThrow({ where: { id: learners.guest.userId } }),
      ]);

      expect(buddy).toMatchObject({ buddyGlasses: "star", buddyKind: "otto", memoryEnabled: true });
      expect(stocks).toMatchObject({ dailyLimitMinutes: 60, memoryEnabled: true });
      expect(guest.isAnonymous).toBe(true);
    });

    /*
     * These checks seed again at other moments; the other checks read today's seed, so it's
     * written again once they're done.
     */
    describe("seeded at another moment", () => {
      let today: Date;

      beforeAll(() => {
        today = new Date();
      });

      afterAll(async () => {
        vi.setSystemTime(today);
        await seedV2();
      }, 120_000);

      it("stores the plan a refresh keeps when the clocks change while it runs", async () => {
        const goingBack = await listRefreshChangesSeededAt(BEFORE_CLOCKS_GO_BACK);
        const goingForward = await listRefreshChangesSeededAt(BEFORE_CLOCKS_GO_FORWARD);

        expect(goingBack).toStrictEqual([]);
        expect(goingForward).toStrictEqual([]);
      }, 120_000);

      // Seeded on a Sunday, Ana's "last Sunday" was today, so she had no mock taken.
      it("gives the exam persona a mock taken when the seed runs on a Sunday", async () => {
        vi.setSystemTime(SUNDAY_IN_SAO_PAULO);
        await seedV2();

        const { goalId } = learners.exam;
        const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

        const [history, estimate] = await Promise.all([
          loadExamHistory({ goalId, today: goalToday(goal) }),
          loadGoalScoreEstimate({ goal, ledgerMocks: [] }),
        ]);

        expect(history.mocks).toHaveLength(1);
        expect(estimate?.scale).toBe("irt");
      }, 120_000);
    });
  });
});
