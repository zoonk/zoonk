import { createRequire } from "node:module";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { courseGoalFixture, signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { MIND_MAP_STALE_AFTER_MS } from "./_utils/mind-map-view";
import { getChapterMindMap } from "./get-chapter-mind-map";
import { listGoalMindMaps } from "./list-goal-mind-maps";
import { requestChapterMindMap } from "./request-chapter-mind-map";

type DriverClient = { query: (...args: unknown[]) => unknown };

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The pg driver @zoonk/db's adapter uses, to read the SQL it sends.
const { Client } = createRequire(import.meta.resolve("@zoonk/db"))("pg") as {
  Client: { prototype: DriverClient };
};

const originalQuery = Client.prototype.query;

async function recordStatements<T>(callback: () => Promise<T>) {
  const texts: string[] = [];

  Client.prototype.query = function query(this: unknown, ...args: unknown[]) {
    const [config] = args;
    const text = typeof config === "string" ? config : (config as { text?: string })?.text;
    texts.push(text ?? "");
    return Reflect.apply(originalQuery, this, args);
  };

  const counts = await countDatabaseStatements(callback);
  Client.prototype.query = originalQuery;

  return { ...counts, texts };
}

async function writeLessons(lessonIds: string[]) {
  await prisma.lesson.updateMany({
    data: { contentStatus: "completed" },
    where: { id: { in: lessonIds } },
  });
}

function noticeSubject(name: string, topic: string) {
  return {
    citation: { passage: "Conteúdo programático", sourceId: "notice" },
    name,
    questions: 10,
    topics: [topic],
    weight: null,
  };
}

function graphSkill(skill: { id: string; name: string }, area: string) {
  return { area, lessons: 1, name: skill.name, phase: 0, skillId: skill.id };
}

/**
 * An exam whose plan schedules a later subject first, then a subject's second chapter before its
 * first: the syllabus numbers a subject's finished chapters first.
 */
async function examScheduledOutOfOrder() {
  const user = await userFixture();

  const [blueprint, spelling, law, cohesion] = await Promise.all([
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          noticeSubject("Língua Portuguesa", "Ortografia"),
          noticeSubject("Direito Constitucional", "Princípios"),
        ],
      },
    }),
    skillFixture({ name: "Aplicar a ortografia" }),
    skillFixture({ name: "Aplicar os princípios" }),
    skillFixture({ name: "Analisar a coesão" }),
  ]);

  const [goal, spellingChapter, lawChapter, cohesionChapter] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
    libraryChapterFixture({ title: "Grafia" }),
    libraryChapterFixture({ title: "A Constituição" }),
    libraryChapterFixture({ title: "Coesão" }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ name: "Fundamentos" }],
      skills: [
        graphSkill(spelling, "Língua Portuguesa"),
        graphSkill(law, "Direito Constitucional"),
        graphSkill(cohesion, "Língua Portuguesa"),
      ],
    },
  });

  const scheduled = [
    { chapter: lawChapter, skill: law, status: "todo" },
    { chapter: cohesionChapter, skill: cohesion, status: "todo" },
    { chapter: spellingChapter, skill: spelling, status: "done" },
  ] as const;

  await Promise.all(
    scheduled.map(async ({ chapter, skill, status }, position) => {
      const lesson = await libraryLessonFixture({ title: chapter.title });

      await Promise.all([
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
        planItemFixture({
          chapterId: chapter.id,
          planId: plan.id,
          position,
          skillId: skill.id,
          status,
        }),
      ]);
    }),
  );

  mockSession(user.id);
  return goal;
}

function firstLessons(fixture?: { lessons: { id: string }[] }) {
  return fixture?.lessons.slice(0, 2).map((lesson) => lesson.id) ?? [];
}

async function readyMindMaps(goalId: string) {
  const result = await listGoalMindMaps({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected the goal's mind maps, got ${result.status}`);
  }

  return result.mindMaps;
}

describe("mind maps read from the saved plan", () => {
  afterEach(() => {
    Client.prototype.query = originalQuery;
  });

  it("lists every chapter of the plan that can have a map, finished or not, with its row's status", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const statuses = ["done", "testedOut", "todo", "todo"] as const;

    const [written, stale, making, owed, language, broken, setAside] = await Promise.all(
      Array.from({ length: 7 }, () =>
        courseGoalFixture({ statuses: [...statuses], userId: user.id }),
      ),
    );

    await Promise.all([
      prisma.goal.update({ data: { kind: "language" }, where: { id: language?.goal.id } }),
      writeLessons([...firstLessons(written), ...firstLessons(owed), ...firstLessons(language)]),
      prisma.lesson.updateMany({
        data: { contentStatus: "failed", setAsideAt: new Date() },
        where: { id: { in: firstLessons(setAside) } },
      }),
      prisma.chapter.update({
        data: { targetLanguage: "es" },
        where: { id: setAside?.chapters[1]?.id },
      }),
      prisma.chapterMindMap.create({
        data: {
          chapterId: stale?.chapters[0]?.id ?? "",
          language: "en",
          status: "running",
          updatedAt: new Date(Date.now() - 2 * MIND_MAP_STALE_AFTER_MS),
        },
      }),
      prisma.chapterMindMap.create({
        data: { chapterId: making?.chapters[0]?.id ?? "", language: "en", status: "running" },
      }),
      prisma.chapterMindMap.create({
        data: {
          chapterId: broken?.chapters[0]?.id ?? "",
          language: "en",
          status: "completed",
          structure: { title: "Half a map" },
        },
      }),
      prisma.followUp.create({
        data: {
          input: { chapterId: owed?.chapters[0]?.id, goalId: owed?.goal.id },
          key: owed?.chapters[0]?.id ?? "",
          kind: "makeChapterMindMap",
          userId: user.id,
        },
      }),
    ]);

    const goals = [written, stale, making, owed, language, broken, setAside].flatMap((fixture) =>
      fixture ? [fixture.goal] : [],
    );

    const listed = await Promise.all(
      goals.map(async (goal) => {
        const mindMaps = await readyMindMaps(goal.id);
        return mindMaps.chapters.map(({ lessonsToWrite, status }) => [status, lessonsToWrite]);
      }),
    );

    const unwritten = ["available", 2];

    expect(listed).toStrictEqual([
      [["available", 0], unwritten],
      [["failed", 2], unwritten],
      [["writingLessons", 2], unwritten],
      [["drawing", 0], unwritten],
      [],
      [["failed", 2], unwritten],
      [],
    ]);
  });

  it("lists chapters as the syllabus numbers them, not as the plan schedules them", async () => {
    const goal = await examScheduledOutOfOrder();
    const mindMaps = await readyMindMaps(goal.id);

    expect(
      mindMaps.chapters.map(({ position, subject, title }) => [subject?.name, position, title]),
    ).toStrictEqual([
      ["Língua Portuguesa", 1, "Grafia"],
      ["Língua Portuguesa", 2, "Coesão"],
      ["Direito Constitucional", 1, "A Constituição"],
    ]);
  });

  it("keeps a chapter the plan files a lesson under only by the lesson's home", async () => {
    const { beginner, chapters, goal, plan } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const [lesson, skill] = await Promise.all([
      libraryLessonFixture({
        contentStatus: "completed",
        homeChapterId: beginner.id,
        title: "Waves",
      }),
      skillFixture({ name: "Wavelength" }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      chapterLessonFixture({ chapterId: beginner.id, lessonId: lesson.id, position: 0 }),
      planItemFixture({
        lessonId: lesson.id,
        phase: 0,
        planId: plan.id,
        position: 4,
        status: "done",
        titleSnapshot: lesson.title,
      }),
    ]);

    await expect(getChapterMindMap({ chapterId: beginner.id })).resolves.toMatchObject({
      mindMap: { chapterId: beginner.id, status: "available", title: "Waves" },
      status: "ready",
    });

    const mindMaps = await readyMindMaps(goal.id);

    expect(mindMaps.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([
      ...chapters.map((chapter) => chapter.id),
      beginner.id,
    ]);

    await expect(
      requestChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toMatchObject({ lessonIds: [], status: "start" });
  });

  it.each(["the same skill", "a duplicate merged into it"])(
    "files no chapter under a lesson's home when an earlier chapter teaches %s first",
    async (taught) => {
      const { beginner, chapters, goal, lessons, plan, skills } = await signedInCourseGoal({
        statuses: ["done", "done", "todo", "todo"],
      });

      const [atom] = skills;

      const [lesson, duplicate] = await Promise.all([
        libraryLessonFixture({
          contentStatus: "completed",
          homeChapterId: beginner.id,
          title: "Atoms again",
        }),
        skillFixture({ mergedIntoId: atom?.id ?? null, name: "Atom (duplicate)" }),
      ]);

      await Promise.all([
        lessonSkillFixture({
          lessonId: lesson.id,
          skillId: (taught === "the same skill" ? atom?.id : duplicate.id) ?? "",
        }),
        chapterLessonFixture({ chapterId: beginner.id, lessonId: lesson.id, position: 0 }),
        planItemFixture({
          lessonId: lesson.id,
          phase: 0,
          planId: plan.id,
          position: 4,
          status: "done",
          titleSnapshot: lesson.title,
        }),
        writeLessons(lessons.slice(0, 2).map((row) => row.id)),
      ]);

      await expect(getChapterMindMap({ chapterId: beginner.id })).resolves.toStrictEqual({
        status: "notFound",
      });

      await expect(
        requestChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
      ).resolves.toStrictEqual({ status: "notFound" });

      const mindMaps = await readyMindMaps(goal.id);

      expect(mindMaps.chapters.map((chapter) => chapter.chapterId)).toStrictEqual(
        chapters.map((chapter) => chapter.id),
      );
    },
  );

  it("reads the saved plan's chapters in one grouped statement, without the goal's map", async () => {
    const { goal } = await signedInCourseGoal({ statuses: ["done", "done", "todo", "todo"] });

    const { result, texts, writes } = await recordStatements(() =>
      listGoalMindMaps({ goalId: goal.id }),
    );

    expect(result.status).toBe("ready");
    expect(writes).toBe(0);

    expect(texts.filter((text) => /learner_skills/u.test(text))).toStrictEqual([]);

    const grouped = texts.filter((text) => /JOIN plan_items i ON i\.plan_id = p\.id/u.test(text));

    expect(grouped).toHaveLength(1);
  });
});
