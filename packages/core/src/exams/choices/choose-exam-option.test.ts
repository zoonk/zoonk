import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { endLessonsAsk } from "../../lookahead/lessons-ask";
import { keepPaceOwn } from "../../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { openStudyDay } from "../../sessions/open-study-day";
import { startStudyBlock } from "../../sessions/start-study-block";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import {
  ENGLISH,
  ENGLISH_II,
  FOREIGN,
  FOREIGN_LANGUAGE,
  HISTORY,
  LANGUAGES,
  MATH,
  PHILOSOPHY,
  SPANISH,
  SPANISH_HISTORY,
  choiceBlueprintFixture,
  twoChoiceBlueprintFixture,
} from "./_test-utils/choice-blueprint";
import { chooseExamOption } from "./choose-exam-option";

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const TIME_ZONE = "America/Sao_Paulo";

async function setup({ built = true }: { built?: boolean } = {}) {
  const user = await userFixture();
  const blueprint = await choiceBlueprintFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: LANGUAGES, lessons: 2 },
      { area: ENGLISH, lessons: 1 },
      { area: SPANISH, lessons: 1 },
      { area: MATH, lessons: 2 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  if (built) {
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
  }

  mockSession(user.id);

  return { goal, library, plan, user };
}

async function loadChoices(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanSettings(plan.settings).examChoices;
}

const spanish = { group: FOREIGN, subjects: [SPANISH], timeZone: TIME_ZONE };

async function openToday(goalId: string) {
  const opened = await openStudyDay({ goalId, shownDate: TODAY, timeZone: TIME_ZONE });

  if (opened.status !== "opened") {
    throw new Error(`Expected today to open, got ${opened.status}`);
  }

  return opened.session;
}

/** Includes a lesson the plan splits between today and later days. */
async function loadTodaysLessonIds(goalId: string): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({
    where: { lessonId: { not: null }, plan: { goalId } },
  });

  const todays = items.filter(
    (item) =>
      (item.scheduledFor !== null && toIsoDate(item.scheduledFor) <= TODAY) ||
      readSelectedItemFacts(item.facts)?.days?.some(([date, , raw]) => date === TODAY && raw > 0),
  );

  return new Set(todays.flatMap((item) => item.lessonId ?? []));
}

async function writeStandInLessons(
  library: Awaited<ReturnType<typeof planLibraryFixture>>,
): Promise<string[]> {
  const [chapter] = library.chapters;
  const skillId = library.skills[1]?.id ?? "";

  return Promise.all(
    Array.from({ length: 4 }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter?.id ?? null,
        title: `Written lesson ${index + 1} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter?.id ?? "",
          lessonId: lesson.id,
          position: 150 + index,
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);

      return lesson.id;
    }),
  );
}

describe(chooseExamOption, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("replaces today's pending lessons when the learner switches exam options", async () => {
    const { goal, library, plan } = await setup();
    await chooseExamOption({ goalId: goal.id, input: spanish });
    const skill = library.graph.skills.find((item) => item.area === SPANISH);

    const items = await prisma.planItem.findMany({
      where: { lessonId: { not: null }, planId: plan.id, skillId: skill?.skillId },
    });

    const lessonIds = items.flatMap((item) => item.lessonId ?? []);
    expect(lessonIds.length).toBeGreaterThan(0);

    const opened = await openStudyDay({
      goalId: goal.id,
      shownDate: "2020-09-28",
      timeZone: TIME_ZONE,
    });

    expect(opened.status).toBe("opened");

    const pending = () =>
      prisma.studySessionBlock.count({
        where: {
          lessonId: { in: lessonIds },
          session: { goalId: goal.id },
          status: { in: ["pending", "active"] },
        },
      });

    await expect(pending()).resolves.toBeGreaterThan(0);
    await chooseExamOption({ goalId: goal.id, input: { ...spanish, subjects: [ENGLISH] } });
    await expect(pending()).resolves.toBe(0);
  });

  it("keeps the learner's option with their plan, as a change they can undo", async () => {
    const { goal, plan } = await setup();

    const result = await chooseExamOption({ goalId: goal.id, input: spanish });

    expect(result).toMatchObject({ change: { status: "applied" }, status: "applied" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);

    const changeId = result.status === "applied" ? (result.change?.id ?? "") : "";

    const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });

    expect(change.payload).toMatchObject({
      operations: [{ group: FOREIGN, kind: "setExamChoice", subjects: [SPANISH] }],
      source: "learner",
    });

    const english = await chooseExamOption({
      goalId: goal.id,
      input: { ...spanish, subjects: [ENGLISH] },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [ENGLISH] },
    ]);

    await decidePlanChange({
      changeId: english.status === "applied" ? (english.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone", timeZone: TIME_ZONE },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);
  });

  it("keeps the rest of the subject a picked option is part of, as the plan's areas name it, with the option inside it", async () => {
    const user = await userFixture();
    const blueprint = await choiceBlueprintFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Linguagens", lessons: 2 },
        { area: ENGLISH, lessons: 1 },
        { area: SPANISH, lessons: 1 },
        { area: "Matemática", lessons: 2 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    await chooseExamOption({ goalId: goal.id, input: spanish });

    const result = await getSyllabusView({ goalId: goal.id });
    const syllabus = result.status === "ready" ? result.syllabus : null;

    expect(
      syllabus?.subjects.map((subject) => [subject.name, subject.source, subject.lessonsTotal]),
    ).toStrictEqual([
      [LANGUAGES, "notice", 3],
      [MATH, "notice", 2],
    ]);
  });

  it("owes the lessons of the subjects a choice brings in, even when the request fails after saving it", async () => {
    const { goal, plan, user } = await setup();

    vi.spyOn(prisma.planChange, "findUniqueOrThrow").mockRejectedValueOnce(
      new Error("Connection lost"),
    );

    await expect(chooseExamOption({ goalId: goal.id, input: spanish })).rejects.toThrow(
      "Connection lost",
    );

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);

    await expect(
      prisma.followUp.findMany({ select: { key: true, kind: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ key: goal.id, kind: "prepareGoalLessons" }]);
  });

  it("changes nothing when the learner picks the option they already take", async () => {
    const { goal } = await setup();

    await chooseExamOption({ goalId: goal.id, input: spanish });
    const again = await chooseExamOption({ goalId: goal.id, input: spanish });

    expect(again).toStrictEqual({ change: null, status: "applied" });

    await expect(prisma.planChange.count({ where: { plan: { goalId: goal.id } } })).resolves.toBe(
      1,
    );
  });

  it("keeps the option for the planner when the plan isn't built yet", async () => {
    const { goal, plan } = await setup({ built: false });

    await expect(chooseExamOption({ goalId: goal.id, input: spanish })).resolves.toStrictEqual({
      change: null,
      status: "applied",
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);
  });

  it("refuses an option the exam doesn't offer, and a choice it doesn't have", async () => {
    const { goal, plan } = await setup();

    await expect(
      chooseExamOption({ goalId: goal.id, input: { ...spanish, subjects: ["Língua Francesa"] } }),
    ).resolves.toStrictEqual({ error: "unknownOption", status: "invalid" });

    await expect(
      chooseExamOption({ goalId: goal.id, input: { ...spanish, subjects: [LANGUAGES] } }),
    ).resolves.toStrictEqual({ error: "unknownOption", status: "invalid" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);
  });

  it("never changes another learner's plan", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(chooseExamOption({ goalId: goal.id, input: spanish })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("keeps a started day to its own lessons once the lessons it waited on are written", async () => {
    await keepPaceOwn();

    const [user, blueprint, course] = await Promise.all([
      userFixture(),
      choiceBlueprintFixture(),
      courseFixture({ outlineStatus: "completed" }),
    ]);

    const library = await planLibraryFixture({
      skills: [
        { area: LANGUAGES, lessons: 2 },
        { area: MATH, lessons: 0, size: 4 },
        { area: ENGLISH, lessons: 2 },
        { area: SPANISH, lessons: 2 },
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

    const opened = await openToday(goal.id);
    const [first] = opened.blocks;

    await startStudyBlock({
      blockId: first?.id ?? "",
      input: { timeZone: TIME_ZONE },
      sessionId: opened.id,
    });

    await chooseExamOption({ goalId: goal.id, input: spanish });
    const written = await writeStandInLessons(library);

    const { lessonsAskedAt } = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    await endLessonsAsk({
      askedAt: lessonsAskedAt?.getTime() ?? 0,
      goalId: goal.id,
      startedCourseIds: [],
    });

    const day = await openToday(goal.id);
    const todays = await loadTodaysLessonIds(goal.id);
    const lessonIds = day.blocks.flatMap((block) => block.lessonId ?? []);

    expect(lessonIds.some((id) => written.includes(id))).toBe(true);
    expect(lessonIds.filter((id) => !todays.has(id))).toStrictEqual([]);
  });

  it("changes one choice of an exam with several and keeps the others", async () => {
    const user = await userFixture();
    const blueprint = await twoChoiceBlueprintFixture();

    const { goal, plan } = await unplannedGoalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      language: "es",
      settings: { examChoices: [{ group: HISTORY, subjects: [SPANISH_HISTORY] }] },
      userId: user.id,
    });

    mockSession(user.id);

    await chooseExamOption({
      goalId: goal.id,
      input: { group: FOREIGN_LANGUAGE, subjects: [ENGLISH_II], timeZone: TIME_ZONE },
    });

    await chooseExamOption({
      goalId: goal.id,
      input: { group: HISTORY, subjects: [PHILOSOPHY], timeZone: TIME_ZONE },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: HISTORY, subjects: [PHILOSOPHY] },
      { group: FOREIGN_LANGUAGE, subjects: [ENGLISH_II] },
    ]);
  });
});
