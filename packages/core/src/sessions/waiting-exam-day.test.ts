import { type GenerationStatus, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  FOREIGN,
  LANGUAGES,
  MATH,
  SPANISH,
  choiceBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { chooseExamOption } from "../exams/choices/choose-exam-option";
import { replanGoalsWaitingOnSkills } from "../library/curriculum/replan-waiting-goals";
import { endLessonsAsk } from "../lookahead/lessons-ask";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { daysAgo, dueSkillFixture } from "./_test-utils/session-goal";
import { loadDayLessonIds } from "./_test-utils/todays-lessons";
import { openStudyDay } from "./open-study-day";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const TIME_ZONE = "America/Sao_Paulo";

type Library = Awaited<ReturnType<typeof planLibraryFixture>>;

async function openToday(goalId: string) {
  const opened = await openStudyDay({ goalId, shownDate: TODAY, timeZone: TIME_ZONE });

  if (opened.status !== "opened") {
    throw new Error(`Expected today to open, got ${opened.status}`);
  }

  return opened.session;
}

async function startFirstBlock(goalId: string) {
  const day = await openToday(goalId);

  await startStudyBlock({
    blockId: day.blocks[0]?.id ?? "",
    input: { timeZone: TIME_ZONE },
    sessionId: day.id,
  });
}

async function writeLessons({
  count,
  library,
  skillIndex,
}: {
  count: number;
  library: Library;
  skillIndex: number;
}): Promise<string[]> {
  const [chapter] = library.chapters;
  const skillId = library.skills[skillIndex]?.id ?? "";

  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter?.id ?? null,
        title: `Written lesson ${skillIndex}.${index} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter?.id ?? "",
          lessonId: lesson.id,
          position: 1000 + skillIndex * 100 + index,
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);

      return lesson.id;
    }),
  );
}

/** An exam goal at 30 minutes a day whose plan gives today 2 written lessons and a stand-in of 8. */
async function setupExamDay({ outlineStatus }: { outlineStatus: GenerationStatus }) {
  const [user, blueprint, course] = await Promise.all([
    userFixture(),
    choiceBlueprintFixture(),
    courseFixture({ outlineStatus }),
  ]);

  const library = await planLibraryFixture({
    skills: [
      { area: LANGUAGES, lessons: 2 },
      { area: MATH, lessons: 0, size: 8 },
      { area: LANGUAGES, lessons: 6 },
      { area: MATH, lessons: 12 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    primaryCourseId: course.id,
    settings: { startDate: TODAY },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { course, goal, library };
}

async function readDay(goalId: string) {
  const day = await openToday(goalId);
  const allocated = await loadDayLessonIds({ goalId, today: TODAY });
  const lessonIds = day.blocks.flatMap((block) => block.lessonId ?? []);

  return { allocated, day, later: lessonIds.filter((id) => !allocated.has(id)), lessonIds };
}

async function endAsk(goalId: string) {
  const { lessonsAskedAt } = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

  await endLessonsAsk({ askedAt: lessonsAskedAt?.getTime() ?? 0, goalId, startedCourseIds: [] });
}

describe("an exam day that waited on lessons", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps a day an exam pick left waiting to the plan's day once some of its lessons are written", async () => {
    const { goal, library } = await setupExamDay({ outlineStatus: "completed" });
    await startFirstBlock(goal.id);

    await chooseExamOption({
      goalId: goal.id,
      input: { group: FOREIGN, subjects: [SPANISH], timeZone: TIME_ZONE },
    });

    const written = await writeLessons({ count: 1, library, skillIndex: 1 });
    await endAsk(goal.id);
    const after = await readDay(goal.id);

    expect(after.lessonIds).toStrictEqual(expect.arrayContaining([...after.allocated, ...written]));
    expect(after.later).toStrictEqual([]);
    expect(after.day.lessonsToPrepare).toBe(true);
  });

  it.each([0, 1])(
    "gets the same day as one opened after the outline once it ends with %i of 8 lessons written",
    async (count) => {
      const waited = await setupExamDay({ outlineStatus: "running" });
      await startFirstBlock(waited.goal.id);

      const written = await writeLessons({ count, library: waited.library, skillIndex: 1 });
      await replanGoalsWaitingOnSkills({ skillIds: [waited.library.skills[1]?.id ?? ""] });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: waited.course.id },
      });

      const after = await readDay(waited.goal.id);

      const opened = await setupExamDay({ outlineStatus: "completed" });
      await writeLessons({ count, library: opened.library, skillIndex: 1 });
      await replanGoalsWaitingOnSkills({ skillIds: [opened.library.skills[1]?.id ?? ""] });
      const twin = await readDay(opened.goal.id);

      expect(after.lessonIds).toStrictEqual(expect.arrayContaining(written));
      expect(after.later).toStrictEqual([]);

      expect(after.day).toMatchObject({
        lessonsToPrepare: true,
        minutes: { planned: twin.day.minutes.planned },
      });
    },
  );

  it("offers the plan's next lessons once the learner finishes a day the outline left short", async () => {
    const { course, goal, library } = await setupExamDay({ outlineStatus: "running" });
    const opened = await openToday(goal.id);

    await replanGoalsWaitingOnSkills({ skillIds: [library.skills[1]?.id ?? ""] });
    await prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: course.id } });

    await prisma.studySessionBlock.updateMany({
      data: { status: "completed" },
      where: { sessionId: opened.id },
    });

    const { day } = await readDay(goal.id);

    expect(day.extraTime).toMatchObject({ available: true });
    expect(day.extraTime.lessons.length).toBeGreaterThan(0);
  });

  it.each(["before", "after"])(
    "adds the lessons written for each course as they land, for a learner who studied %s the day opened",
    async (studied) => {
      const [user, blueprint, courseA, courseB] = await Promise.all([
        userFixture(),
        choiceBlueprintFixture(),
        courseFixture({ outlineStatus: "running" }),
        courseFixture({ outlineStatus: "running" }),
      ]);

      const library = await planLibraryFixture({
        skills: [
          { area: LANGUAGES, lessons: 1 },
          { area: MATH, lessons: 0, size: 4 },
          { area: LANGUAGES, lessons: 0, size: 2 },
          { area: MATH, lessons: 12 },
          { area: LANGUAGES, lessons: 6 },
        ],
      });

      const graph = {
        ...library.graph,
        skills: library.graph.skills.map((skill, index) =>
          index === 2 ? { ...skill, courseIds: [courseB.id] } : skill,
        ),
      };

      const { goal } = await unplannedGoalFixture({
        dailyMinutes: 30,
        examBlueprintId: blueprint.id,
        kind: "exam",
        primaryCourseId: courseA.id,
        settings: { startDate: TODAY },
        userId: user.id,
      });

      const studiedSkillId = library.skills[0]?.id ?? "";

      const studySkill = () =>
        dueSkillFixture({ due: daysAgo(-10), skillId: studiedSkillId, userId: user.id });

      await Promise.all([
        createGoalPlan({ goalId: goal.id, graph }),
        courseChapterFixture({ chapterId: library.chapters[0]?.id ?? "", courseId: courseA.id }),
        courseChapterFixture({ chapterId: library.chapters[0]?.id ?? "", courseId: courseB.id }),
        ...Array.from({ length: 60 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: studiedSkillId }),
        ),
        studied === "before" ? studySkill() : null,
      ]);

      mockSession(user.id);

      const opened = await openToday(goal.id);

      expect(opened.lessonsComing).toBe(true);

      if (studied === "after") {
        await studySkill();
      }

      const writtenA = await writeLessons({ count: 4, library, skillIndex: 1 });
      await replanGoalsWaitingOnSkills({ skillIds: [library.skills[1]?.id ?? ""] });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: courseA.id },
      });

      const afterA = await readDay(goal.id);

      expect(afterA.day.lessonsComing).toBe(true);

      expect(afterA.lessonIds).toStrictEqual(
        expect.arrayContaining(writtenA.filter((id) => afterA.allocated.has(id))),
      );

      const writtenB = await writeLessons({ count: 2, library, skillIndex: 2 });
      await replanGoalsWaitingOnSkills({ skillIds: [library.skills[2]?.id ?? ""] });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: courseB.id },
      });

      const afterB = await readDay(goal.id);
      const landedToday = [...writtenA, ...writtenB].filter((id) => afterB.allocated.has(id));

      expect(writtenB.some((id) => afterB.allocated.has(id))).toBe(true);
      expect(afterB.lessonIds).toStrictEqual(expect.arrayContaining(landedToday));
      expect(afterB.later).toStrictEqual([]);
    },
  );
});
