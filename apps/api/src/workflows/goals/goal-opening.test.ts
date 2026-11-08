import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/curriculum/course-outline";
import { checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { generateGoalOpening } from "@zoonk/ai/tasks/curriculum/goal-opening";
import { generateWholeSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { generateItems } from "@zoonk/ai/tasks/items/generate";
import { generatePlacementItems } from "@zoonk/ai/tasks/items/placement-items";
import { generateWarmUpCards } from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { recordedOutput, replayStreamedOutline, taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import * as outlineSteps from "../courses/steps/course-outline-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { goalContentWorkflow } from "./goal-content-workflow";

type SkillGraph = Awaited<ReturnType<typeof generateWholeSkillGraph>>["data"];
type Opening = Awaited<ReturnType<typeof generateGoalOpening>>["data"];
type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];
type Specificity = Awaited<ReturnType<typeof classifyGoalSpecificity>>["data"];

const recordedGraph = recordedOutput<SkillGraph>("skill-graph");
const recordedOutline = recordedOutput<CourseOutline>("course-outline");
const recordedSpecificity = recordedOutput<Specificity>("goal-specificity");

/** Library rows are found by name, so names only this test uses keep it from reusing others'. */
function isolated(): { graph: SkillGraph; opening: Opening } {
  const token = crypto.randomUUID().slice(0, 8);

  const graph: SkillGraph = {
    ...recordedGraph,
    courses: recordedGraph.courses.map((course) => ({
      ...course,
      title: `${course.title} ${token}`,
    })),
    skills: recordedGraph.skills.map((skill) => ({ ...skill, name: `${skill.name} ${token}` })),
  };

  const [course] = graph.courses;
  const [skill] = graph.skills;
  const [chapter] = recordedOutline.chapters;

  if (!course || !skill || !chapter) {
    throw new Error("The recorded graph and outline have a course, a skill and a chapter.");
  }

  const opening: Opening = {
    chapter: {
      ...chapter,
      lessons: chapter.lessons
        .slice(0, 2)
        .map((lesson) => ({ ...lesson, title: `${lesson.title} ${token}` })),
      skillKeys: [skill.key],
      title: `${chapter.title} ${token}`,
    },
    graph: { ...graph, courses: [course], skills: [skill] },
    skill,
  };

  return { graph, opening };
}

async function newGoal() {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { answered: [], level: "basic", purpose: "overview" },
    prompt: "Understand how vaccines train the immune system",
    title: "How vaccines work",
    userId: user.id,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  return { goal, user };
}

function lessonRunsEndReady() {
  getStartMock().mockImplementation(async (workflow, args) => {
    const [input] = args as [{ lessonId?: string }];

    return {
      returnValue: Promise.resolve(
        workflow === lessonContentWorkflow ? { lessonId: input.lessonId, status: "ready" } : null,
      ),
      runId: "started-run",
    } as never;
  });
}

function openingLessonStarts() {
  return getStartMock()
    .mock.calls.filter(([workflow]) => workflow === lessonContentWorkflow)
    .map(([, args]) => (args as [Record<string, unknown>])[0])
    .filter((input) => input.speed === "fast");
}

describe("a learn goal's opening", () => {
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  let graph: SkillGraph;
  let opening: Opening;

  beforeEach(() => {
    ({ graph, opening } = isolated());

    lessonRunsEndReady();
    vi.mocked(generateGoalOpening).mockResolvedValue(taskResult(opening));
    vi.mocked(generateWholeSkillGraph).mockResolvedValue({ ...taskResult(graph), repaired: [] });
    vi.mocked(generateWarmUpCards).mockResolvedValue(taskResult({ cards: [] }));
    vi.mocked(classifyGoalSpecificity).mockResolvedValue(taskResult(recordedSpecificity));
    vi.mocked(generateCourseOutline).mockResolvedValue(taskResult(recordedOutline));

    vi.mocked(streamCourseOutline).mockImplementation(
      replayStreamedOutline(recordedOutline) as never,
    );

    vi.mocked(generateItems).mockResolvedValue(taskResult({ items: [] }) as never);
    vi.mocked(generatePlacementItems).mockResolvedValue(taskResult({ skills: [] }) as never);

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    vi.mocked(checkCoverage).mockResolvedValue(
      taskResult({ examWeights: [], missing: [], placements: [] }),
    );
  });

  it("writes the first lesson through the learner's own start, fast, and plans from it", async () => {
    const { goal, user } = await newGoal();

    // The graph is the slower call, so the first lesson is saved by the time it's written.
    vi.mocked(generateWholeSkillGraph).mockImplementation(async () => {
      await vi.waitFor(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        expect(saved.openingLessonId).not.toBeNull();
      });

      return { ...taskResult(graph), repaired: [] };
    });

    await goalContentWorkflow({ goalId: goal.id });

    const { openingLessonId } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: openingLessonId ?? "" } });

    expect(lesson.title).toBe(opening.chapter.lessons[0]?.title);

    expect(openingLessonStarts()).toStrictEqual([
      {
        analytics: expect.objectContaining({ distinctId: user.id }),
        forExam: false,
        lessonId: lesson.id,
        speed: "fast",
        wait: "learner",
      },
    ]);

    await expect(
      prisma.usageRecord.count({ where: { kind: "lessonStart", targetId: lesson.id } }),
    ).resolves.toBe(1);

    const first = await prisma.planItem.findFirst({
      orderBy: { position: "asc" },
      where: { kind: "lesson", plan: { goalId: goal.id } },
    });

    expect(first?.lessonId).toBe(lesson.id);

    expect(vi.mocked(generateWholeSkillGraph).mock.calls[0]?.[0].firstSkill).toStrictEqual({
      course: { key: opening.graph.courses[0]?.key, title: opening.graph.courses[0]?.title },
      description: opening.skill.description,
      key: opening.skill.key,
      level: opening.skill.level,
      name: opening.skill.name,
    });

    // The graph writes the first skill again under its key, and the plan keeps the saved one.
    await expect(prisma.skill.count({ where: { name: opening.skill.name } })).resolves.toBe(1);

    await expect(
      prisma.course.findFirstOrThrow({ where: { title: opening.graph.courses[0]?.title } }),
    ).resolves.toMatchObject({ outlineStatus: "completed" });

    const firstLessonEvents = getStreamedEvents().filter(
      ({ step }) => step === "writeFirstLesson" || step === "firstLessonReady",
    );

    expect(firstLessonEvents).toStrictEqual([
      {
        entityId: goal.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        status: "started",
        step: "writeFirstLesson",
      },
      { entityId: goal.id, lessonId: lesson.id, status: "completed", step: "firstLessonReady" },
    ]);
  });

  it("opens the lesson an earlier run picked and writes the graph from its skill again", async () => {
    const { goal } = await newGoal();
    const token = crypto.randomUUID().slice(0, 8);

    const [course, chapter, skill] = await Promise.all([
      courseFixture({ title: `Immunology ${token}` }),
      libraryChapterFixture({ outlineStatus: "completed" }),
      skillFixture({ level: "overview", name: `Identify pathogens ${token}` }),
    ]);

    const picked = await libraryLessonFixture({
      homeChapterId: chapter.id,
      title: `Picked ${token}`,
    });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "overview" }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    ]);

    // An earlier run saved the opening and stopped before its lesson's run started.
    await prisma.goal.update({ data: { openingLessonId: picked.id }, where: { id: goal.id } });

    await goalContentWorkflow({ goalId: goal.id });

    expect(generateGoalOpening).not.toHaveBeenCalled();
    expect(openingLessonStarts().map((input) => input.lessonId)).toStrictEqual([picked.id]);

    expect(vi.mocked(generateWholeSkillGraph).mock.calls[0]?.[0].firstSkill).toMatchObject({
      course: { title: course.title },
      level: "overview",
      name: skill.name,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      openingLessonId: picked.id,
    });
  });

  it("plans the first lesson as before when the opening fails for good", async () => {
    const { goal } = await newGoal();
    vi.mocked(generateGoalOpening).mockRejectedValue(new Error("Provider unavailable"));

    await goalContentWorkflow({ goalId: goal.id });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      openingLessonId: null,
    });

    expect(openingLessonStarts()).toStrictEqual([]);
    expect(getStreamedEvents().some(({ step }) => step === "writeFirstLesson")).toBe(false);

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Generation Failed",
        properties: { content_kind: "curriculum", model: null, task: "goal-opening" },
      }),
    );

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ buildFailedAt: null });
  });

  it("waits for a course another run is outlining before writing the first chapter into it", async () => {
    const { goal } = await newGoal();
    const claim = outlineSteps.claimCourseOutlineStep;

    vi.spyOn(outlineSteps, "claimCourseOutlineStep")
      .mockResolvedValueOnce({ tags: [], value: "running" })
      .mockImplementation(claim);

    await goalContentWorkflow({ goalId: goal.id });

    expect(sleep).toHaveBeenCalledWith("15s");
    expect(openingLessonStarts()).toHaveLength(1);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      openingLessonId: expect.any(String),
    });
  });

  it("leaves the first lesson to the plan when the course stays busy", async () => {
    const { goal } = await newGoal();

    vi.spyOn(outlineSteps, "claimCourseOutlineStep").mockResolvedValue({
      tags: [],
      value: "running",
    });

    await goalContentWorkflow({ goalId: goal.id });

    expect(openingLessonStarts()).toStrictEqual([]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      openingLessonId: null,
    });

    // The graph still starts from the saved first skill.
    expect(vi.mocked(generateWholeSkillGraph).mock.calls[0]?.[0].firstSkill).toMatchObject({
      name: opening.skill.name,
    });
  });

  it("leaves exam and language goals to their own start", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { answered: ["reason", "level"], level: "basic" },
      kind: "language",
      language: "pt",
      prompt: `Quero aprender italiano ${crypto.randomUUID().slice(0, 8)}`,
      targetLanguage: "it",
      userId: user.id,
    });

    await goalContentWorkflow({ goalId: goal.id });

    expect(generateGoalOpening).not.toHaveBeenCalled();

    expect(start).not.toHaveBeenCalledWith(lessonContentWorkflow, [
      expect.objectContaining({ speed: "fast" }),
    ]);
  });
});
