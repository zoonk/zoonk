import { createRequire } from "node:module";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadLearnerFacts } from "../learner/summary/_utils/load-learner-facts";
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

/** The SQL the callback sends, besides running it. */
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

  it("names the chapter the learner is in, with its lessons left, from the saved plan", async () => {
    const { chapters, goal, items, user } = await signedInCourseGoal({
      statuses: ["done", "todo", "todo", "todo"],
    });

    const [first, second] = chapters;

    await expect(readyMindMaps(goal.id)).resolves.toMatchObject({
      chapters: [],
      nextChapter: { chapterId: first?.id, lessonsLeft: 1, title: "The very small world" },
    });

    // A lesson tested out counts as finished: the plan moves on to the second chapter.
    await prisma.planItem.update({ data: { status: "testedOut" }, where: { id: items[1]?.id } });

    await expect(readyMindMaps(goal.id)).resolves.toMatchObject({
      nextChapter: { chapterId: second?.id, lessonsLeft: 2, title: "Inside the atom" },
    });

    // A plan without a deadline sets aside only what it can't teach: not a lesson left.
    await prisma.planItem.update({ data: { status: "skipped" }, where: { id: items[3]?.id } });

    await expect(readyMindMaps(goal.id)).resolves.toMatchObject({
      nextChapter: { chapterId: second?.id, lessonsLeft: 1 },
    });

    // Today's session opens a lesson first: its chapter is the one the learner is in.
    await prisma.planItem.updateMany({
      data: { status: "todo" },
      where: { id: { in: [items[1]?.id ?? "", items[3]?.id ?? ""] } },
    });

    await prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await studySessionBlockFixture({
      lessonId: items[2]?.lessonId ?? null,
      payload: { planItemId: items[2]?.id },
      position: 0,
      sessionId: session.id,
      status: "pending",
    });

    await expect(readyMindMaps(goal.id)).resolves.toMatchObject({
      nextChapter: { chapterId: second?.id, lessonsLeft: 2 },
    });

    // Nothing left to study: no chapter is next.
    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { planId: items[0]?.planId },
    });

    await expect(readyMindMaps(goal.id)).resolves.toMatchObject({ nextChapter: null });
  });

  it("lists the goals the summary says have mind maps, by the same rule", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const finished = ["done", "testedOut", "todo", "todo"] as const;

    const [written, unwritten, stale, making, language, broken] = await Promise.all(
      Array.from({ length: 6 }, () =>
        courseGoalFixture({ statuses: [...finished], userId: user.id }),
      ),
    );

    await prisma.goal.update({ data: { kind: "language" }, where: { id: language?.goal.id } });

    await Promise.all([
      writeLessons(written?.lessons.slice(0, 2).map((lesson) => lesson.id) ?? []),
      writeLessons(language?.lessons.slice(0, 2).map((lesson) => lesson.id) ?? []),
      // A run that stopped long ago without its lessons written has nothing to show.
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
      // A map saved without an outline learners can read, and no lessons to draw it again from.
      prisma.chapterMindMap.create({
        data: {
          chapterId: broken?.chapters[0]?.id ?? "",
          language: "en",
          status: "completed",
          structure: { title: "Half a map" },
        },
      }),
    ]);

    const goals = [written, unwritten, stale, making, language, broken].flatMap((fixture) =>
      fixture ? [fixture.goal] : [],
    );

    const listed = await Promise.all(
      goals.map(async (goal) => {
        const mindMaps = await readyMindMaps(goal.id);
        return { chapters: mindMaps.chapters.map((chapter) => chapter.status), goalId: goal.id };
      }),
    );

    expect(listed.map((goal) => goal.chapters)).toStrictEqual([
      ["available"],
      [],
      [],
      ["generating"],
      [],
      [],
    ]);

    const { mindMapGoalIds } = await loadLearnerFacts(user.id);

    expect(mindMapGoalIds.toSorted()).toStrictEqual(
      listed.flatMap((goal) => (goal.chapters.length > 0 ? [goal.goalId] : [])).toSorted(),
    );
  });

  it("keeps a chapter the plan files a lesson under only by the lesson's home", async () => {
    const { beginner, goal, plan, user } = await signedInCourseGoal({
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

    // A lesson item saved without its chapter or skill: the plan files it under its lesson's home.
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

    expect(mindMaps.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([beginner.id]);

    await expect(loadLearnerFacts(user.id)).resolves.toMatchObject({ mindMapGoalIds: [goal.id] });

    await expect(
      requestChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toMatchObject({ status: "start" });
  });

  it.each(["the same skill", "a duplicate merged into it"])(
    "files no chapter under a lesson's home when an earlier chapter teaches %s first",
    async (taught) => {
      const { beginner, chapters, goal, lessons, plan, skills, user } = await signedInCourseGoal({
        statuses: ["done", "done", "todo", "todo"],
      });

      const [first] = chapters;
      const [atom] = skills;

      const [lesson, duplicate] = await Promise.all([
        libraryLessonFixture({
          contentStatus: "completed",
          homeChapterId: beginner.id,
          title: "Atoms again",
        }),
        skillFixture({ mergedIntoId: atom?.id ?? null, name: "Atom (duplicate)" }),
      ]);

      // The first chapter teaches the atom first, so the map files this lesson's skill there.
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

      expect(mindMaps.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([first?.id]);

      await expect(loadLearnerFacts(user.id)).resolves.toMatchObject({ mindMapGoalIds: [goal.id] });
    },
  );

  it("reads the saved plan's chapters in one grouped statement, without the goal's map", async () => {
    const { goal } = await signedInCourseGoal({ statuses: ["done", "done", "todo", "todo"] });

    const { result, statements, texts, writes } = await recordStatements(() =>
      listGoalMindMaps({ goalId: goal.id }),
    );

    expect(result.status).toBe("ready");
    expect(writes).toBe(0);

    // The goal's map reads every skill and the learner's state on each: the listing needs neither.
    expect(texts.filter((text) => /learner_skills/u.test(text))).toStrictEqual([]);

    // One statement reads every chapter's facts from the saved plan; numbering reads it on its own.
    const grouped = texts.filter((text) => /JOIN plan_items i ON i\.plan_id = p\.id/u.test(text));

    expect(grouped).toHaveLength(1);
    // Numbering's syllabus input reads the goal through the request's goal fact, which a request
    // shares with the ownership check; tests run without that dedupe, so they count it again.
    expect(statements).toBeLessThanOrEqual(19);
  });
});
