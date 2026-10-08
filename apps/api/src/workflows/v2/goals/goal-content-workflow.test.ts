import { setTimeout } from "node:timers/promises";
import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { SKILL_GRAPH_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/curriculum/skill-graph-version";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/v2/identity/goal-specificity";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { extractPastQuestions } from "@zoonk/ai/tasks/v2/items/past-questions";
import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { classifyWorkField } from "@zoonk/ai/tasks/v2/items/work-field";
import { EXAM_BLUEPRINT_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint-version";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { z } from "zod";
import { mockHookConflict } from "../../../../mocks/workflow";
import { mockLastRunEvent } from "../../../../mocks/workflow-runtime";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { getStartMock } from "../../_test-utils/start-mock";
import { recordedOutput, replayStreamedOutline, taskResult } from "../_test-utils/recorded-outputs";
import { courseDetailsWorkflow } from "../courses/course-details-workflow";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { levelTestBankWorkflow } from "../language/level-test-bank-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { goalContentWorkflow } from "./goal-content-workflow";
import { placementItemsWorkflow } from "./placement-items-workflow";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ exists: Promise.resolve(false), status: Promise.resolve("completed") })),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: tests replay a real run's goal classification, skill graph and outline.
vi.mock("@zoonk/ai/tasks/v2/curriculum/course-outline", () => ({
  generateCourseOutline: vi.fn(),
  streamCourseOutline: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/curriculum/coverage-check", () => ({ checkCoverage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/curriculum/skill-graph", () => ({ generateSkillGraph: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/identity/goal-specificity", () => ({
  classifyGoalSpecificity: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/items/generate", () => ({ generateItems: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/items/placement-items", () => ({ generatePlacementItems: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/items/work-field", () => ({ classifyWorkField: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/items/past-questions", () => ({ extractPastQuestions: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

type SkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];
type Specificity = Awaited<ReturnType<typeof classifyGoalSpecificity>>["data"];

const recordedGraph = recordedOutput<SkillGraph>("skill-graph");

/**
 * The recorded graph with skill and course names only this test uses. Skills and courses are
 * shared Library rows found by name, so without this a test would reuse the skills, courses and
 * outlined lessons an earlier run left in the test database.
 */
function isolatedGraph(): SkillGraph {
  const token = crypto.randomUUID().slice(0, 8);

  return {
    ...recordedGraph,
    courses: recordedGraph.courses.map((course) => ({
      ...course,
      title: `${course.title} ${token}`,
    })),
    skills: recordedGraph.skills.map((skill) => ({ ...skill, name: `${skill.name} ${token}` })),
  };
}

const recordedOutline = recordedOutput<CourseOutline>("course-outline");

/** The part of a stored plan graph that says which course each skill's lessons come from. */
const planCoursesSchema = z.object({
  skills: z.array(z.object({ courseIds: z.array(z.string()) })),
});

const recordedSpecificity = recordedOutput<Specificity>("goal-specificity");
const TIMEOUT = 60_000;
/** How long the research in a test runs at most before ending on its own. */
const RESEARCH_LIMIT_MS = 3000;

const placementItem = {
  context: null,
  difficulty: "easy" as const,
  format: "multipleChoice" as const,
  image: null,
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason: "Antibodies bind the antigen.",
      text: "Antibodies",
    },
    {
      isCorrect: false,
      misconception: "Thinks fever itself kills germs",
      reason: "Fever is a response, not a weapon that targets one germ.",
      text: "Fever",
    },
  ],
  question: "What part of the immune response recognizes one specific germ?",
  visual: null,
};

const typedPlacementItem = {
  acceptedAnswers: [],
  context: null,
  difficulty: "medium" as const,
  format: "typed" as const,
  image: null,
  keyPoints: ["A vaccine trains the immune system to recognize a germ before an infection"],
  question: "In your own words: how does a vaccine protect you?",
  sampleAnswer: "It trains the immune system to recognize a germ before a real infection.",
  visual: null,
};

const freeResponseItem = {
  context: "A researcher measures how fast yeast ferments sugar at five temperatures.",
  difficulty: "medium" as const,
  format: "essay" as const,
  keyPoints: ["Names temperature as the independent variable"],
  question: "(a) Identify the independent variable. (b) Explain why the rate drops above 40 °C.",
  rubric: [
    { criterion: "(a) Variable", description: "Identifies temperature", points: 1 },
    { criterion: "(b) Explanation", description: "Explains enzyme denaturation", points: 2 },
  ],
  sampleOutline: "(a) Temperature. (b) Enzymes denature, so fewer active sites.",
};

const ITEMS_BY_FORMAT: Partial<Record<ItemFormat, GeneratedItem>> = { essay: freeResponseItem };

/** Field practice asks multiple choice, AP a free response; each call gets its own. */
function placementItemsFor({ format }: { format: ItemFormat }) {
  const items: GeneratedItem[] = [ITEMS_BY_FORMAT[format] ?? placementItem];
  return taskResult({ items });
}

/** A Cebraspe-style assertion, judged right or wrong. */
const trueFalsePlacementItem = {
  context: null,
  difficulty: "medium" as const,
  format: "trueFalse" as const,
  image: null,
  isTrue: false,
  misconception: "Thinks a vaccine treats an infection it already has",
  reason: "A vaccine prepares the immune system before an infection; it doesn't cure one.",
  statement: "A vaccine cures an infection the person already has.",
  visual: null,
};

/** Placement's writer: a quick question in the asked format and, when asked, a typed one. */
function placementBatchFor(params: PlacementItemsParams) {
  const quick = params.quickFormat === "trueFalse" ? trueFalsePlacementItem : placementItem;

  return taskResult({
    skills: params.skills.map(() => ({
      quick: [quick],
      typed: params.typedCount > 0 ? [typedPlacementItem] : [],
    })),
  });
}

async function newGoal(attrs: Partial<Parameters<typeof goalFixture>[0]> = {}) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { level: "none", purpose: "overview" },
    prompt: "Understand how vaccines train the immune system",
    title: "How vaccines work",
    userId: user.id,
    ...attrs,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  return { goal, user };
}

/**
 * What every test's `start` does: placement's questions are a run of their own, which runs inline
 * here, as the runtime would in the background, so tests see what it writes. Other runs only start.
 */
async function runPlacementInline(workflow: unknown, args: unknown[]) {
  if (workflow === placementItemsWorkflow) {
    await placementItemsWorkflow(...(args as Parameters<typeof placementItemsWorkflow>));
  }

  return { runId: "started-run" } as Awaited<ReturnType<typeof start>>;
}

/** Runs the course outline a goal starts inline too, as the runtime would in the background. */
function runOutlinesInline() {
  getStartMock().mockImplementation(async (workflow, args) => {
    if (workflow === courseOutlineWorkflow) {
      await courseOutlineWorkflow(...(args as Parameters<typeof courseOutlineWorkflow>));
    }

    return runPlacementInline(workflow, args);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const citation = { passage: "", sourceId: "notice" };

/** A notice's structure with one subject and its topics, as research reads it. */
function examStructure(topics: string[]) {
  return {
    formats: [{ citation, description: "Multiple choice", kind: "multipleChoice", options: null }],
    mock: null,
    rules: [],
    subjects: [{ citation, name: "Immunology", questions: null, topics, weight: 1 }],
  };
}

/**
 * Research is still running when the goal's run first asks about it: it does `work` then (links
 * what it read) and ends, so the run finds it done once that work is saved.
 */
function researchEndsWhenAsked(work: () => Promise<void>) {
  const ended: { current: Promise<void> | null } = { current: null };

  vi.mocked(getRun).mockImplementation(() => {
    ended.current ??= work();

    return {
      exists: Promise.resolve(true),
      status: ended.current.then(() => "completed"),
    } as never;
  });
}

/** The ISO date `days` from today. */
function inDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

/** A notice's edition with one exam day. */
function examDayEdition(date: string) {
  return {
    citations: [],
    dates: [{ citation, date, kind: "exam", label: "Exam day" }],
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    year: Number(date.slice(0, 4)),
  };
}

/** The exam weight each skill of a stored plan graph carries. */
const planWeightsSchema = z.object({
  skills: z.array(z.object({ skillId: z.string(), weight: z.number().nullable() })),
});

/** The graph with its first skill teaching one topic of the notice's subject. */
function withTopic({ graph, topic }: { graph: SkillGraph; topic: string }): SkillGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill, index) =>
      index === 0 ? { ...skill, area: "Immunology", topics: [topic] } : skill,
    ),
  };
}

const planPlacesSchema = z.object({
  skills: z.array(
    z.object({ area: z.string().nullable(), topics: z.array(z.string()).optional() }),
  ),
});

describe(goalContentWorkflow, () => {
  // Shared courses live in the AI organization, which a fresh test database doesn't have.
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  let graph: SkillGraph;

  beforeEach(() => {
    graph = isolatedGraph();
    getStartMock().mockImplementation(runPlacementInline);

    vi.mocked(classifyGoalSpecificity).mockResolvedValue(
      taskResult(recordedSpecificity, "openai/gpt-6-luna"),
    );

    vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(graph));
    vi.mocked(generateCourseOutline).mockResolvedValue(taskResult(recordedOutline));

    vi.mocked(streamCourseOutline).mockImplementation(
      replayStreamedOutline(recordedOutline) as never,
    );

    vi.mocked(generateItems).mockImplementation(async (params) => placementItemsFor(params));

    vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
      placementBatchFor(params),
    );

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
  });

  // A test that says how another run stands leaves the next one the default.
  afterEach(() => {
    vi.mocked(getRun).mockReset();
  });

  it(
    "builds the skill graph, the plan and the main course, and starts the outlines and placement questions",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();

      const result = await goalContentWorkflow({ goalId: goal.id, platform: "web" });

      expect(result).toStrictEqual({ goalId: goal.id, speculativeLessonIds: [], status: "built" });

      const [stored, plan, items, questions] = await Promise.all([
        prisma.goal.findUniqueOrThrow({ include: { primaryCourse: true }, where: { id: goal.id } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.planItem.findMany({ where: { kind: "lesson", plan: { goalId: goal.id } } }),
        prisma.item.count({
          where: { skill: { planItems: { some: { plan: { goalId: goal.id } } } } },
        }),
      ]);

      expect(stored.primaryCourse).toMatchObject({
        title: graph.courses[0]?.title,
        visibility: "public",
      });

      // The run is saved on its goal, so onboarding can follow it live.
      expect(stored.generationRunId).toStrictEqual(expect.any(String));

      expect(plan.phases).toHaveLength(graph.phases.length);

      // Each skill's lessons come from the Library course its graph course became, never another
      // subject's course that happens to teach the same shared skill.
      const { skills } = planCoursesSchema.parse(plan.graph);

      expect(skills.map((skill) => skill.courseIds)).toStrictEqual(
        skills.map(() => [stored.primaryCourseId]),
      );

      expect(items).toHaveLength(graph.skills.length);
      expect(items.every((item) => item.skillId !== null && item.lessonId === null)).toBe(true);
      expect(questions).toBeGreaterThan(0);

      // The learner waits on the graph, the band their plan's first lesson is in and placement's
      // questions: those are written first, at the standard tier (never priority).
      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          analytics: { distinctId: goal.userId, goalId: goal.id, platform: "web" },
          courseId: stored.primaryCourseId,
          waitedSkillId: items.toSorted((a, b) => a.position - b.position)[0]?.skillId,
        }),
      ]);

      // The plan counts for the client whose request started the run.
      expect(trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: goal.userId,
          name: "Plan Created",
          shared: expect.objectContaining({ platform: "web" }),
        }),
      );

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0].serviceTier).toBeUndefined();
      // Placement's questions come two skills per call, each skill with a quick question and a
      // typed one that confirms a right pick.
      const placementCalls = vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params);
      const placementSkills = placementCalls.reduce((total, call) => total + call.skills.length, 0);

      expect(placementCalls.length).toBeGreaterThan(0);
      expect(placementCalls.length).toBeLessThan(placementSkills);

      expect(
        placementCalls.every(
          (call) =>
            call.serviceTier === undefined &&
            call.skills.length <= 2 &&
            call.quickCount === 1 &&
            call.typedCount === 1,
        ),
      ).toBe(true);

      await expect(
        prisma.item.count({
          where: { format: "typed", skill: { planItems: { some: { plan: { goalId: goal.id } } } } },
        }),
      ).resolves.toBe(placementSkills);

      const events = getStreamedEvents().map(
        (event) => `${String(event.step)}:${String(event.status)}`,
      );

      expect(events.filter((event) => !event.startsWith("preparePlacement"))).toStrictEqual([
        "understandGoal:started",
        "buildSkillGraph:started",
        "buildSkillGraph:completed",
        "saveSkills:started",
        "createPlan:completed",
        "outlineCourses:started",
        "prepareFirstLessons:started",
        "goalReady:completed",
      ]);

      // Placement's wait opens while the skills are saved; its questions are written by a run of
      // their own, which the goal's run never waits on.
      expect(events.indexOf("preparePlacement:started")).toBe(
        events.indexOf("saveSkills:started") + 1,
      );

      expect(start).toHaveBeenCalledWith(placementItemsWorkflow, [
        expect.objectContaining({ goalId: goal.id, skillIds: expect.any(Array) }),
      ]);

      // Placement stops waiting for questions that didn't come once they're all written.
      expect(plan.placementPreparedAt).toBeInstanceOf(Date);
      expect(plan.buildFailedAt).toBeNull();
    },
  );

  it(
    "starts placement's questions once every skill is saved, without waiting for the rest of the plan",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();
      const names = graph.skills.map((skill) => skill.name);
      const countSkills = () => prisma.skill.count({ where: { name: { in: names } } });
      const atCalls: number[] = [];

      vi.mocked(generatePlacementItems).mockImplementation(async (params) => {
        atCalls.push(await countSkills());
        return placementBatchFor(params);
      });

      await goalContentWorkflow({ goalId: goal.id });

      // Placement's questions need only the skills they ask about, not the plan's links or
      // courses: their run starts once every skill is saved, and the goal's run never waits on it.
      const saved = await countSkills();

      expect(saved).toBeGreaterThan(0);
      expect(atCalls.length).toBeGreaterThan(0);
      expect(atCalls).toStrictEqual(atCalls.map(() => saved));
    },
  );

  it(
    "reports a curriculum it couldn't build as a failed generation for the learner who asked",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();
      vi.mocked(generateSkillGraph).mockRejectedValue(new Error("Provider unavailable"));

      await expect(goalContentWorkflow({ goalId: goal.id, platform: "ios" })).rejects.toThrow(
        "Provider unavailable",
      );

      expect(getStreamedEvents().at(-1)).toMatchObject({
        reason: "aiGenerationFailed",
        status: "error",
      });

      // Placement and the plan stop waiting for a plan that won't come, and offer to try again.
      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ buildFailedAt: expect.any(Date) });

      expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          distinctId: goal.userId,
          name: "Generation Failed",
          properties: { content_kind: "curriculum", model: null, task: "goal-content" },
          shared: expect.objectContaining({ platform: "ios" }),
        }),
      );
    },
  );

  it(
    "makes the goal ready even when the questions written ahead for placement fail",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();
      vi.mocked(generatePlacementItems).mockRejectedValue(new Error("Provider unavailable"));

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
        goalId: goal.id,
        speculativeLessonIds: [],
        status: "built",
      });

      expect(generatePlacementItems).toHaveBeenCalledWith(
        expect.objectContaining({ quickFormat: "multipleChoice" }),
      );

      expect(getStreamedEvents().at(-1)).toMatchObject({ status: "completed", step: "goalReady" });

      await expect(
        prisma.planItem.count({ where: { kind: "lesson", plan: { goalId: goal.id } } }),
      ).resolves.toBe(graph.skills.length);

      // The failures are counted, not hidden: placement stops waiting and goes on without them.
      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ buildFailedAt: null, placementPreparedAt: expect.any(Date) });

      expect(trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Generation Failed",
          properties: { content_kind: "curriculum", model: null, task: "placement-questions" },
        }),
      );
    },
  );

  it(
    "tries a placement question that failed once more before counting it",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();

      vi.mocked(generatePlacementItems)
        .mockRejectedValueOnce(new Error("Provider hiccup"))
        .mockImplementation(async (params) => placementBatchFor(params));

      await goalContentWorkflow({ goalId: goal.id });

      expect(trackServerEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: "Generation Failed" }),
      );

      await expect(
        prisma.item.count({
          where: { skill: { planItems: { some: { plan: { goalId: goal.id } } } } },
        }),
      ).resolves.toBeGreaterThan(0);
    },
  );

  it(
    "clears a failed build when the learner starts the goal again",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();
      vi.mocked(generateSkillGraph).mockRejectedValueOnce(new Error("Provider unavailable"));

      await expect(goalContentWorkflow({ goalId: goal.id })).rejects.toThrow();

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "built",
      });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ buildFailedAt: null, placementPreparedAt: expect.any(Date) });
    },
  );

  it(
    "decides who the curriculum is for while the learner is still answering",
    { timeout: TIMEOUT },
    async () => {
      const onboardingId = crypto.randomUUID();
      const { goal } = await newGoal({ details: { onboardingId, subject: "Vaccines" } });

      vi.mocked(sleep).mockImplementationOnce(async () => {
        expect(classifyGoalSpecificity).toHaveBeenCalledOnce();
        expect(generateSkillGraph).not.toHaveBeenCalled();

        await prisma.goal.update({
          data: {
            details: {
              answered: ["purpose", "level"],
              level: "basic",
              onboardingId,
              purpose: "overview",
              subject: "Vaccines",
            },
          },
          where: { id: goal.id },
        });
      });

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "built",
      });

      expect(classifyGoalSpecificity).toHaveBeenCalledOnce();
    },
  );

  it("reports a goal that no longer exists without building anything", async () => {
    const goalId = crypto.randomUUID();

    await expect(goalContentWorkflow({ goalId })).resolves.toStrictEqual({
      goalId,
      speculativeLessonIds: [],
      status: "missing",
    });

    expect(generateSkillGraph).not.toHaveBeenCalled();
    expect(getStreamedEvents().at(-1)).toMatchObject({ reason: "notFound", status: "error" });
  });

  it(
    "starts the first lessons of the likely starting phases once the first outline lands",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal();
      runOutlinesInline();

      const result = await goalContentWorkflow({ goalId: goal.id });

      // A free learner starting from nothing skips placement: two lessons of the one phase they
      // start, the first one as a wait the learner sees, the next minutes away; a Plus subscriber
      // gets four.
      expect(result.speculativeLessonIds).toHaveLength(2);

      const analytics = { distinctId: user.id, goalId: goal.id };

      for (const [index, lessonId] of result.speculativeLessonIds.entries()) {
        expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
          { analytics, forExam: false, lessonId, wait: index === 0 ? "learner" : "soon" },
        ]);
      }

      const { goal: plusGoal, user: plus } = await newGoal();

      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: plus.id, status: "active" },
      });

      await expect(goalContentWorkflow({ goalId: plusGoal.id })).resolves.toMatchObject({
        speculativeLessonIds: expect.toSatisfy((ids: string[]) => ids.length === 4),
      });
    },
  );

  it(
    "starts the plan's first lesson as soon as its band lands, without waiting for the rest of the opening",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal();
      const lesson = await libraryLessonFixture({ level: "overview" });

      // No outline runs: only the first lesson's band lands, the rest of the opening stays
      // stand-ins for skills. Each start notes how many polls the run had waited by then.
      const pollsBeforeStart: number[] = [];

      getStartMock().mockImplementation(async (workflow, args) => {
        if (workflow === lessonContentWorkflow) {
          pollsBeforeStart.push(vi.mocked(sleep).mock.calls.length);
        }

        return runPlacementInline(workflow, args);
      });

      vi.mocked(sleep).mockImplementationOnce(async () => {
        const first = await prisma.planItem.findFirstOrThrow({
          orderBy: { position: "asc" },
          where: { kind: "lesson", plan: { goalId: goal.id } },
        });

        await prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: first.id } });
      });

      const result = await goalContentWorkflow({ goalId: goal.id });

      expect(result.speculativeLessonIds).toStrictEqual([lesson.id]);

      // It starts on the poll after its band lands, not once the opening's wait runs out.
      expect(pollsBeforeStart).toStrictEqual([1]);

      expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
        {
          analytics: { distinctId: user.id, goalId: goal.id },
          forExam: false,
          lessonId: lesson.id,
          wait: "learner",
        },
      ]);
    },
  );

  it(
    "writes the first lesson of each phase placement may start the learner in",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({ details: { level: "basic", purpose: "overview" } });
      const [phase] = graph.phases;

      // Two phases: placement may start a learner who knows the basics in either one.
      vi.mocked(generateSkillGraph).mockResolvedValue(
        taskResult({
          ...graph,
          phases: phase ? [phase, { ...phase, title: `${phase.title} 2` }] : [],
          skills: graph.skills.map((skill, index) => (index < 8 ? skill : { ...skill, phase: 2 })),
        }),
      );

      runOutlinesInline();
      await goalContentWorkflow({ goalId: goal.id });

      const items = await prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { kind: "lesson", plan: { goalId: goal.id }, status: "todo" },
      });

      const phaseStarts = [...new Set(items.map((item) => item.phase))].map(
        (planPhase) => items.find((item) => item.phase === planPhase)?.lessonId,
      );

      const startedLessons = getStartMock()
        .mock.calls.flatMap(([workflow, args]) =>
          workflow === lessonContentWorkflow
            ? (args as Parameters<typeof lessonContentWorkflow>)
            : [],
        )
        .map((input) => input.lessonId);

      expect(phaseStarts).toHaveLength(2);
      expect(startedLessons).toStrictEqual(phaseStarts);
    },
  );

  it(
    "writes the plan's new first lesson when placement moves the learner's start",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal();
      runOutlinesInline();

      // Placement tests the learner out of the opening while the first lessons are written.
      vi.mocked(sleep).mockImplementationOnce(async () => {
        const opening = await prisma.planItem.findMany({
          orderBy: { position: "asc" },
          take: 4,
          where: { kind: "lesson", plan: { goalId: goal.id } },
        });

        await prisma.planItem.updateMany({
          data: { status: "testedOut" },
          where: { id: { in: opening.map((item) => item.id) } },
        });
      });

      const result = await goalContentWorkflow({ goalId: goal.id });

      const moved = await prisma.planItem.findFirstOrThrow({
        orderBy: { position: "asc" },
        where: { kind: "lesson", plan: { goalId: goal.id }, status: "todo" },
      });

      expect(result.speculativeLessonIds).not.toContain(moved.lessonId);

      expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
        {
          analytics: { distinctId: user.id, goalId: goal.id },
          forExam: false,
          lessonId: moved.lessonId,
          wait: "learner",
        },
      ]);
    },
  );

  it("never starts speculative lessons for a guest", { timeout: TIMEOUT }, async () => {
    const { goal, user } = await newGoal();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    runOutlinesInline();

    await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      speculativeLessonIds: [],
      status: "built",
    });

    expect(getStartMock().mock.calls.some(([workflow]) => workflow === lessonContentWorkflow)).toBe(
      false,
    );

    // A guest's outlines leave the courses' background work to a learner with an account.
    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({ forGuest: true }),
    ]);

    // The outlines ran and gave the plan its lessons, yet didn't start the courses' page details.
    await expect(
      prisma.planItem.count({ where: { lessonId: { not: null }, plan: { goalId: goal.id } } }),
    ).resolves.toBeGreaterThan(0);

    expect(getStartMock().mock.calls.some(([workflow]) => workflow === courseDetailsWorkflow)).toBe(
      false,
    );
  });

  it(
    "starts a shared course's page details once an account's outline lands, never its other bands",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();
      runOutlinesInline();

      await goalContentWorkflow({ goalId: goal.id });

      const { primaryCourseId } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

      expect(start).toHaveBeenCalledWith(courseDetailsWorkflow, [
        expect.objectContaining({ courseId: primaryCourseId }),
      ]);
    },
  );

  it(
    "writes a started course's curriculum into that course, even when the graph names others",
    { timeout: TIMEOUT },
    async () => {
      const token = crypto.randomUUID().slice(0, 8);

      const course = await courseFixture({
        isPublished: true,
        title: `Robotics ${token}`,
        visibility: "public",
      });

      // The model split the goal across two courses; the learner started one.
      vi.mocked(generateSkillGraph).mockResolvedValue(
        taskResult({
          ...graph,
          courses: [
            ...graph.courses,
            { key: "electronics", levels: ["overview"], title: `Electronics ${token}` },
          ],
          skills: graph.skills.map((skill, index) =>
            index % 2 === 0 ? skill : { ...skill, course: "electronics" },
          ),
        }),
      );

      const { goal } = await newGoal({
        details: { courseStart: { chapterId: null } },
        primaryCourseId: course.id,
        prompt: course.title,
        title: course.title,
      });

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "built",
      });

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
      const { skills } = planCoursesSchema.parse(plan.graph);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.map((skill) => skill.courseIds)).toStrictEqual(skills.map(() => [course.id]));

      // No other course was found or created for it, and the course is shared as it was.
      await expect(
        prisma.course.count({
          where: {
            title: { in: [`Electronics ${token}`, ...graph.courses.map((item) => item.title)] },
          },
        }),
      ).resolves.toBe(0);

      expect(classifyGoalSpecificity).not.toHaveBeenCalled();

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ primaryCourseId: course.id });

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          courseId: course.id,
          forGuest: false,
          scope: expect.objectContaining({ ownerId: null }),
        }),
      ]);
    },
  );

  it(
    "writes ahead once for a goal that came with its plan: missing outlines, placement and first lessons",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal();

      const [course, skills] = await Promise.all([
        courseFixture(),
        Promise.all([skillFixture({ level: "beginner" }), skillFixture({ level: "beginner" })]),
      ]);

      const plan = await prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Phase 1" }],
            skills: skills.map((skill) => ({
              area: null,
              courseIds: [course.id],
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            })),
          },
        },
        where: { goalId: goal.id },
      });

      // Scheduled today: within every learner's outline window.
      await Promise.all(
        skills.map((skill, position) =>
          planItemFixture({
            planId: plan.id,
            position,
            scheduledFor: new Date(),
            skillId: skill.id,
          }),
        ),
      );

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "prepared",
      });

      expect(generateSkillGraph).not.toHaveBeenCalled();

      // The plan's stand-ins get their course's band outlined, the learner's first skill first.
      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          bands: [expect.objectContaining({ level: "beginner" })],
          courseId: course.id,
          forGuest: false,
          waitedSkillId: skills[0]?.id,
        }),
      ]);

      await expect(
        prisma.item.count({ where: { skillId: { in: skills.map((skill) => skill.id) } } }),
      ).resolves.toBeGreaterThan(0);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

      expect(getStreamedEvents().at(-1)).toMatchObject({ status: "completed", step: "goalReady" });

      // Starting it again finds the work done.
      vi.mocked(generateItems).mockClear();
      vi.mocked(generatePlacementItems).mockClear();

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "ready",
      });

      expect(generateItems).not.toHaveBeenCalled();
      expect(generatePlacementItems).not.toHaveBeenCalled();
    },
  );

  it(
    "leaves a guest's plan that came with the goal without the courses' background work or speculative lessons",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal();

      const [course, skill] = await Promise.all([
        courseFixture(),
        skillFixture({ level: "beginner" }),
        prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } }),
      ]);

      const plan = await prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Phase 1" }],
            skills: [
              {
                area: null,
                courseIds: [course.id],
                lessons: 1,
                name: skill.name,
                phase: 0,
                skillId: skill.id,
                weight: null,
              },
            ],
          },
        },
        where: { goalId: goal.id },
      });

      await planItemFixture({
        planId: plan.id,
        position: 0,
        scheduledFor: new Date(),
        skillId: skill.id,
      });

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        speculativeLessonIds: [],
        status: "prepared",
      });

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({ courseId: course.id, forGuest: true }),
      ]);

      expect(
        getStartMock().mock.calls.some(([workflow]) => workflow === lessonContentWorkflow),
      ).toBe(false);
    },
  );

  it(
    "starts a language goal's level test with its curriculum, and a failed start never fails it",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal({
        kind: "language",
        language: "pt",
        targetLanguage: "ja",
      });

      getStartMock().mockImplementation(async (workflow, args) => {
        if (workflow === levelTestBankWorkflow) {
          throw new Error("Queue unavailable");
        }

        return runPlacementInline(workflow, args);
      });

      await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
        status: "built",
      });

      // A language pair's graph is the same for every learner of it.
      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0].serviceTier).toBe("priority");

      expect(start).toHaveBeenCalledWith(levelTestBankWorkflow, [
        {
          analytics: { distinctId: user.id, goalId: goal.id, platform: undefined },
          pair: { language: "pt", targetLanguage: "ja" },
        },
      ]);
    },
  );

  it(
    "writes a private course on the cheaper model for a goal too specific to share",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal();

      vi.mocked(classifyGoalSpecificity).mockResolvedValue(
        taskResult(
          { generalGoal: null, personalDetails: ["My thesis"], privateCourse: true },
          "openai/gpt-6-luna",
        ),
      );

      await goalContentWorkflow({ goalId: goal.id });

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0].model).toBe(
        "google/gemini-3.8-flash",
      );

      await expect(
        prisma.goal.findUniqueOrThrow({ include: { primaryCourse: true }, where: { id: goal.id } }),
      ).resolves.toMatchObject({ primaryCourse: { userId: user.id, visibility: "private" } });
    },
  );

  it(
    "waits for research to read a class test's own material before its graph, saying so",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal({ kind: "exam" });

      const [blueprint, slides] = await Promise.all([
        examBlueprintFixture({ name: "Immunology board exam" }),
        sourceFixture({
          extractedText: "Slide 1: Innate immunity. Slide 2: Vaccines",
          kind: "upload",
          title: "Class slides",
          visibility: "private",
        }),
      ]);

      await learnerSourceFixture({ goalId: goal.id, sourceId: slides.id, userId: user.id });

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult({ examWeights: [], missing: [], placements: [] }, "google/gemini-3.8-flash"),
      );

      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      vi.mocked(sleep).mockImplementationOnce(async () => {
        expect(generateSkillGraph).not.toHaveBeenCalled();

        await prisma.goal.update({
          data: { examBlueprintId: blueprint.id },
          where: { id: goal.id },
        });

        vi.mocked(getRun).mockReturnValue({
          exists: Promise.resolve(true),
          status: Promise.resolve("completed"),
        } as never);
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0]).toMatchObject({
        context: expect.stringContaining("Slide 2: Vaccines"),
        examBlueprint: expect.objectContaining({ name: "Immunology board exam" }),
        goalKind: "exam",
      });

      // The graph was checked against the material once; the material is the curriculum, so the
      // plan isn't reconciled with research again.
      expect(checkCoverage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          goalKind: "exam",
          references: [expect.objectContaining({ title: "Class slides" })],
        }),
      );

      // Placement probes each skill the way the exam asks it.
      await expect(
        prisma.item.count({ where: { examBlueprintId: blueprint.id } }),
      ).resolves.toBeGreaterThan(0);

      // The wait says what it's waiting for.
      const events = getStreamedEvents().map(
        (event) => `${String(event.step)}:${String(event.status)}`,
      );

      expect(events.slice(1, 4)).toStrictEqual([
        "readExamNotice:started",
        "readExamNotice:completed",
        "buildSkillGraph:started",
      ]);
    },
  );

  it(
    "builds an exam's graph at once when onboarding already found its current blueprint",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        name: "Immunology board exam",
        promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

      // Research is still running: it would only link the same blueprint again.
      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      // Every later learner of the notice reuses the graph the learner watches being built.
      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0]).toMatchObject({
        examBlueprint: expect.objectContaining({ name: "Immunology board exam" }),
        serviceTier: "priority",
      });

      expect(getStreamedEvents().some((event) => event.step === "readExamNotice")).toBe(false);

      // Research never read anything the graph didn't: nothing to reconcile.
      expect(checkCoverage).not.toHaveBeenCalled();
    },
  );

  it(
    "plans a later learner of the same notice from the curriculum an earlier one's goal built, without writing a graph",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        name: "Immunology board exam",
        promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
      });

      // The graph the current instructions wrote, as the plan built from it records.
      const written = taskResult(graph);

      vi.mocked(generateSkillGraph).mockResolvedValue({
        ...written,
        provenance: { ...written.provenance, promptVersion: SKILL_GRAPH_PROMPT_VERSION },
      });

      const earlier = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });
      await goalContentWorkflow({ goalId: earlier.goal.id });

      const [later, otherLevel] = await Promise.all([
        newGoal({ examBlueprintId: blueprint.id, kind: "exam" }),
        newGoal({
          details: { level: "advanced", purpose: "overview" },
          examBlueprintId: blueprint.id,
          kind: "exam",
        }),
      ]);

      vi.mocked(generateSkillGraph).mockClear();
      vi.mocked(generatePlacementItems).mockClear();
      vi.mocked(generateSearchTerms).mockClear();

      await expect(goalContentWorkflow({ goalId: later.goal.id })).resolves.toMatchObject({
        status: "built",
      });

      // No graph, no identity search: the Library already has its skills and courses, and
      // placement's questions for them.
      expect(generateSkillGraph).not.toHaveBeenCalled();
      expect(generateSearchTerms).not.toHaveBeenCalled();
      expect(generatePlacementItems).not.toHaveBeenCalled();

      const [earlierGoal, laterGoal, earlierPlan, laterPlan] = await Promise.all([
        prisma.goal.findUniqueOrThrow({ where: { id: earlier.goal.id } }),
        prisma.goal.findUniqueOrThrow({ where: { id: later.goal.id } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: earlier.goal.id } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: later.goal.id } }),
      ]);

      const skillIdsOf = (plan: typeof earlierPlan) =>
        planCoursesSchema
          .extend({ skills: z.array(z.object({ skillId: z.string() })) })
          .parse(plan.graph)
          .skills.map((skill) => skill.skillId);

      expect(skillIdsOf(laterPlan)).toStrictEqual(skillIdsOf(earlierPlan));
      expect(laterGoal.primaryCourseId).toBe(earlierGoal.primaryCourseId);

      // Its plan counts as written now, so placement waits for questions still being written.
      expect(laterPlan.generatedAt?.getTime()).toBeGreaterThan(
        earlierPlan.generatedAt?.getTime() ?? 0,
      );

      // A learner who gave another level gets a graph of their own.
      await goalContentWorkflow({ goalId: otherLevel.goal.id });
      expect(generateSkillGraph).toHaveBeenCalledOnce();
    },
  );

  it(
    "waits for research to read a current notice again when older instructions read it, and builds from that reading",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        name: "Immunology board exam",
        promptVersion: "older-instructions",
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      // Research reads the notice again meanwhile: the new reading names the notice's groups.
      vi.mocked(sleep).mockImplementationOnce(async () => {
        expect(generateSkillGraph).not.toHaveBeenCalled();

        await prisma.examBlueprint.update({
          data: {
            name: "Immunology board exam (read again)",
            promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
          },
          where: { id: blueprint.id },
        });

        vi.mocked(getRun).mockReturnValue({
          exists: Promise.resolve(true),
          status: Promise.resolve("completed"),
        } as never);
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0]).toMatchObject({
        examBlueprint: expect.objectContaining({ name: "Immunology board exam (read again)" }),
      });

      // The wait says it's reading the exam's notice, not the learner's material.
      const events = getStreamedEvents().map(
        (event) => `${String(event.step)}:${String(event.status)}`,
      );

      expect(events.slice(1, 4)).toStrictEqual([
        "readNotice:started",
        "readNotice:completed",
        "buildSkillGraph:started",
      ]);

      // The plan was built from the new reading: nothing to reconcile or wait for afterwards.
      expect(checkCoverage).not.toHaveBeenCalled();

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ noticeWaitUntil: null });
    },
  );

  it(
    "writes placement's quick questions for an exam that judges assertions as true/false ones under its blueprint",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        name: "Polícia Federal",
        role: "Agente",
        structure: {
          formats: [
            {
              citation: { passage: "Itens do tipo Certo ou Errado.", sourceId: "notice" },
              description: "Cada item é uma afirmação julgada Certo ou Errado.",
              kind: "trueFalse",
              options: null,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

      await goalContentWorkflow({ goalId: goal.id });

      const calls = vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params);

      expect(calls.length).toBeGreaterThan(0);

      expect(
        calls.every(
          (call) =>
            call.quickFormat === "trueFalse" && call.examFormat?.name === "Polícia Federal, Agente",
        ),
      ).toBe(true);

      const quick = await prisma.item.findMany({
        select: { examBlueprintId: true, format: true },
        where: {
          format: { not: "typed" },
          skill: { planItems: { some: { plan: { goalId: goal.id } } } },
        },
      });

      expect(quick.length).toBeGreaterThan(0);

      expect(
        quick.every((item) => item.format === "trueFalse" && item.examBlueprintId === blueprint.id),
      ).toBe(true);
    },
  );

  it(
    "builds a new exam's graph from the exam as understood without waiting for research, and keeps the plan when research reads no notice",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { examName: "Immunology board exam", examYear: 2027, level: "basic" },
        kind: "exam",
      });

      const order: string[] = [];
      const outlinesBefore: number[] = [];

      vi.mocked(generateSkillGraph).mockImplementation(async () => {
        order.push("graph");
        return taskResult(graph);
      });

      // Research finds no official notice for a new exam.
      researchEndsWhenAsked(async () => {
        order.push("research ended");

        outlinesBefore.push(
          getStartMock().mock.calls.filter(([workflow]) => workflow === courseOutlineWorkflow)
            .length,
        );
      });

      await expect(
        goalContentWorkflow({ goalId: goal.id, researchId: "research-run" }),
      ).resolves.toMatchObject({ status: "built" });

      expect(order).toStrictEqual(["graph", "research ended"]);

      // The exam and its year reach the graph through what onboarding understood.
      const [params] = vi.mocked(generateSkillGraph).mock.calls[0] ?? [];

      expect(params).toMatchObject({ examBlueprint: undefined, goalKind: "exam" });
      expect(params?.context).toContain('"examName":"Immunology board exam"');
      expect(params?.context).toContain('"examYear":2027');

      expect(getStreamedEvents().some((event) => event.step === "readExamNotice")).toBe(false);

      // Nothing new to check the plan against: it stays as it was built.
      expect(checkCoverage).not.toHaveBeenCalled();

      expect(
        getStartMock().mock.calls.filter(([workflow]) => workflow === courseOutlineWorkflow),
      ).toHaveLength(outlinesBefore[0] ?? -1);
    },
  );

  it(
    "reconciles a new exam's plan with the notice research reads: adds what it missed, corrects weights and plans to the exam's day",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { examName: "Immunology board exam", level: "basic" },
        kind: "exam",
      });

      const examDay = new Date(Date.now() + 120 * DAY_MS).toISOString().slice(0, 10);

      const blueprint = await examBlueprintFixture({
        edition: {
          citations: [],
          dates: [{ citation, date: examDay, kind: "exam", label: "Exam day" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: Number(examDay.slice(0, 4)),
        },
        name: "Immunology board exam",
        structure: examStructure(["Antibody structure", "Vaccines"]),
      });

      const weighted = {
        ...graph,
        skills: graph.skills.map((skill) => ({ ...skill, examWeight: 3 })),
      };

      const [vaccines, reweighted] = weighted.skills;
      const missed = `Describe how antibodies are built ${crypto.randomUUID().slice(0, 8)}`;

      vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(weighted));

      // The notice's subject is the graph's course, under its own name: the check places the first
      // skill on the topic it teaches, and adds a skill for the topic none does.
      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult(
          {
            examWeights: [{ examWeight: 1, key: reweighted?.key ?? "" }],
            missing: [
              {
                area: "Immunology",
                description: "Heavy and light chains, and the part that binds the antigen.",
                examWeight: 5,
                name: missed,
                prerequisites: [],
                reference: "Immunology board exam",
                syllabusLine: "Antibody structure",
                topics: ["Antibody structure"],
              },
            ],
            placements: [{ area: "Immunology", key: vaccines?.key ?? "", topics: ["Vaccines"] }],
          },
          "google/gemini-3.8-flash",
        ),
      );

      const testedOut: string[] = [];
      const preparedAt: (Date | null)[] = [];

      // While placement runs, it tests the learner out of the plan's first items; then research
      // links the notice it read.
      researchEndsWhenAsked(async () => {
        const opening = await prisma.planItem.findMany({
          orderBy: { position: "asc" },
          take: 2,
          where: { kind: "lesson", plan: { goalId: goal.id } },
        });

        await prisma.planItem.updateMany({
          data: { status: "testedOut" },
          where: { id: { in: opening.map((item) => item.id) } },
        });

        testedOut.push(...opening.map((item) => item.id));

        const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
        preparedAt.push(plan.placementPreparedAt);

        await prisma.goal.update({
          data: { examBlueprintId: blueprint.id },
          where: { id: goal.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      // The graph didn't wait for the notice; the plan was checked against it once research read it.
      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0].examBlueprint).toBeUndefined();

      expect(checkCoverage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          goalKind: "exam",
          references: [
            {
              text: expect.stringContaining(
                "S1. Immunology (weight 100%)\n  S1.1 Antibody structure\n  S1.2 Vaccines",
              ),
              title: "Immunology board exam",
            },
          ],
          skills: expect.arrayContaining([
            expect.objectContaining({ examWeight: 3, key: reweighted?.key }),
          ]),
        }),
      );

      const [plan, stored, added, corrected, items] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.skill.findFirstOrThrow({ where: { name: missed } }),
        prisma.skill.findFirstOrThrow({ where: { name: reweighted?.name } }),
        prisma.planItem.findMany({ where: { plan: { goalId: goal.id } } }),
      ]);

      // The missing topic opens its subject, as the notice lists it first, with its weight; the
      // weight the notice showed was off moved, and every other skill kept its own.
      const { skills } = planWeightsSchema.parse(plan.graph);

      expect(skills).toHaveLength(weighted.skills.length + 1);
      expect(skills[0]).toStrictEqual({ skillId: added.id, weight: 5 });

      // The plan reads the notice's subject and topics, word for word.
      expect(planPlacesSchema.parse(plan.graph).skills.slice(0, 2)).toStrictEqual([
        { area: "Immunology", topics: ["Antibody structure"] },
        { area: "Immunology", topics: ["Vaccines"] },
      ]);

      expect(skills.find((skill) => skill.skillId === corrected.id)?.weight).toBe(1);

      expect(
        skills
          .filter((skill) => skill.skillId !== added.id && skill.skillId !== corrected.id)
          .every((skill) => skill.weight === 3),
      ).toBe(true);

      // A stand-in for the new skill; what placement tested out stays tested out.
      expect(items.find((item) => item.skillId === added.id)).toMatchObject({
        lessonId: null,
        status: "todo",
      });

      expect(
        items.filter((item) => testedOut.includes(item.id)).map((item) => item.status),
      ).toStrictEqual(["testedOut", "testedOut"]);

      // The notice's exam day is what the plan counts down to now. The reading landed while the
      // reveal waited for it, so it's simply the plan: nothing to answer, nothing left waiting.
      expect(stored.targetDate?.toISOString().slice(0, 10)).toBe(examDay);
      expect(plan.noticeWaitUntil).toBeNull();

      await expect(
        prisma.planChange.count({ where: { plan: { goalId: goal.id }, status: "proposed" } }),
      ).resolves.toBe(0);

      // The new stand-in's band is outlined, for a learner with an account.
      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          bands: expect.arrayContaining([
            expect.objectContaining({
              skills: expect.arrayContaining([expect.objectContaining({ id: added.id })]),
            }),
          ]),
          forGuest: false,
        }),
      ]);

      // Placement's pick among the new skills gets its questions in the exam's format, without
      // placement's wait opening again or its questions being recorded as written again.
      await expect(
        prisma.item.count({ where: { examBlueprintId: blueprint.id, skillId: added.id } }),
      ).resolves.toBeGreaterThan(0);

      expect(plan.placementPreparedAt).toStrictEqual(preparedAt[0]);

      const events = getStreamedEvents().map(
        (event) => `${String(event.step)}:${String(event.status)}`,
      );

      expect(events.filter((event) => event.startsWith("preparePlacement"))).toStrictEqual([
        "preparePlacement:started",
      ]);

      expect(events.filter((event) => event === "createPlan:completed")).toHaveLength(1);
    },
  );

  it(
    "proposes a notice read after the learner saw the plan instead of changing it, and stops the reveal's wait",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { examName: "Late board exam", level: "basic" },
        kind: "exam",
      });

      const examDay = new Date(Date.now() + 120 * DAY_MS).toISOString().slice(0, 10);

      const blueprint = await examBlueprintFixture({
        edition: {
          citations: [],
          dates: [{ citation, date: examDay, kind: "exam", label: "Exam day" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: Number(examDay.slice(0, 4)),
        },
        name: "Late board exam",
        structure: examStructure(["Antibody structure", "Vaccines"]),
      });

      const missed = `Describe how antibodies are built ${crypto.randomUUID().slice(0, 8)}`;

      vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(graph));

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult(
          {
            examWeights: [],
            missing: [
              {
                area: "Immunology",
                description: "Heavy and light chains, and the part that binds the antigen.",
                examWeight: 5,
                name: missed,
                prerequisites: [],
                reference: "Late board exam",
                syllabusLine: "Antibody structure",
                topics: ["Antibody structure"],
              },
            ],
            placements: [],
          },
          "google/gemini-3.8-flash",
        ),
      );

      const waited: (Date | null)[] = [];

      // The reveal waited for the notice while research read it, then the wait ran out and the
      // learner saw the plan before research linked the notice.
      researchEndsWhenAsked(async () => {
        const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
        waited.push(plan.noticeWaitUntil);

        await prisma.plan.update({
          data: { noticeWaitUntil: new Date(Date.now() - 1000) },
          where: { goalId: goal.id },
        });

        await prisma.goal.update({
          data: { examBlueprintId: blueprint.id },
          where: { id: goal.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(waited[0]?.getTime()).toBeGreaterThan(Date.now());

      const [plan, stored, added, changes] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.skill.findFirstOrThrow({ where: { name: missed } }),
        prisma.planChange.findMany({ where: { plan: { goalId: goal.id } } }),
      ]);

      // Nothing the learner saw changed: the plan and its date wait for their tap.
      expect(
        planWeightsSchema.parse(plan.graph).skills.map((skill) => skill.skillId),
      ).not.toContain(added.id);

      expect(stored.targetDate).toBeNull();
      expect(plan.noticeWaitUntil).toBeNull();

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ kind: "edited", status: "proposed" });

      expect(changes[0]?.payload).toMatchObject({
        noticeGraph: {
          skills: expect.arrayContaining([expect.objectContaining({ skillId: added.id })]),
        },
        operations: [
          { kind: "followNotice" },
          { estimated: false, kind: "setNoticeDate", targetDate: examDay },
        ],
        source: "notice",
      });
    },
  );

  it(
    "keeps the reveal waiting while the plan is checked against a reading that landed in time, however long the check takes",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { examName: "Slow board exam", level: "basic" },
        kind: "exam",
      });

      const examDay = new Date(Date.now() + 120 * DAY_MS).toISOString().slice(0, 10);

      const blueprint = await examBlueprintFixture({
        edition: {
          citations: [],
          dates: [{ citation, date: examDay, kind: "exam", label: "Exam day" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: Number(examDay.slice(0, 4)),
        },
        name: "Slow board exam",
        structure: examStructure(["Antibody structure", "Vaccines"]),
      });

      const missed = `Describe how antibodies are built ${crypto.randomUUID().slice(0, 8)}`;
      const waits: (Date | null)[] = [];

      vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(graph));

      // The check takes longer than what was left of the reveal's wait when the reading landed.
      vi.mocked(checkCoverage).mockImplementation(async () => {
        await setTimeout(1500);
        const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
        waits.push(plan.noticeWaitUntil);

        return taskResult(
          {
            examWeights: [],
            missing: [
              {
                area: "Immunology",
                description: "Heavy and light chains, and the part that binds the antigen.",
                examWeight: 5,
                name: missed,
                prerequisites: [],
                reference: "Slow board exam",
                syllabusLine: "Antibody structure",
                topics: ["Antibody structure"],
              },
            ],
            placements: [],
          },
          "google/gemini-3.8-flash",
        );
      });

      // Research links the notice it read with a second of the reveal's wait left.
      researchEndsWhenAsked(async () => {
        await prisma.plan.update({
          data: { noticeWaitUntil: new Date(Date.now() + 1000) },
          where: { goalId: goal.id },
        });

        await prisma.goal.update({
          data: { examBlueprintId: blueprint.id },
          where: { id: goal.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      // The reveal was still waiting when the check ended.
      expect(waits[0]?.getTime()).toBeGreaterThan(Date.now());

      const [plan, stored, added, proposals] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.skill.findFirstOrThrow({ where: { name: missed } }),
        prisma.planChange.count({ where: { plan: { goalId: goal.id }, status: "proposed" } }),
      ]);

      // The reading is simply the plan: its skill and its exam day, with nothing to answer.
      expect(planWeightsSchema.parse(plan.graph).skills.map((skill) => skill.skillId)).toContain(
        added.id,
      );

      expect(stored.targetDate?.toISOString().slice(0, 10)).toBe(examDay);
      expect(proposals).toBe(0);

      // The plan stopped waiting, and remembers when: that notice is the plan's own, not news.
      expect(plan.noticeWaitUntil).toBeNull();
      expect(plan.noticeWaitEndedAt).toBeInstanceOf(Date);
    },
  );

  it(
    "follows the exam day a reading that lands in time moves, without asking, when nothing else changes",
    { timeout: TIMEOUT },
    async () => {
      const [planned, moved] = [inDays(120), inDays(127)];

      const blueprint = await examBlueprintFixture({
        edition: examDayEdition(planned),
        name: "Moved board exam",
        promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
        structure: examStructure(["Antibody structure", "Vaccines"]),
      });

      const { goal } = await newGoal({
        details: { examName: "Moved board exam", level: "basic" },
        examBlueprintId: blueprint.id,
        kind: "exam",
      });

      // While the reveal waits, research reads a corrected notice that moves the exam a week.
      researchEndsWhenAsked(async () => {
        await prisma.examBlueprint.update({
          data: { edition: examDayEdition(moved), examDate: new Date(`${moved}T00:00:00.000Z`) },
          where: { id: blueprint.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      const [stored, plan, proposals] = await Promise.all([
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.planChange.count({ where: { plan: { goalId: goal.id }, status: "proposed" } }),
      ]);

      // The plan took its date from the notice before the learner saw it: it simply follows it.
      expect(stored.targetDate?.toISOString().slice(0, 10)).toBe(moved);
      expect(proposals).toBe(0);
      expect(plan.noticeWaitUntil).toBeNull();
    },
  );

  it(
    "proposes what research that restarted after the plan was built reads, from the stored plan",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { examName: "Restarted board exam", level: "basic" },
        kind: "exam",
      });

      const blueprint = await examBlueprintFixture({
        name: "Restarted board exam",
        structure: examStructure(["Antibody structure", "Vaccines"]),
      });

      // The first build's research failed: the plan was built from the exam as understood.
      vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(graph));
      await goalContentWorkflow({ goalId: goal.id });

      const missed = `Describe how antibodies are built ${crypto.randomUUID().slice(0, 8)}`;

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult(
          {
            examWeights: [],
            missing: [
              {
                area: "Immunology",
                description: "Heavy and light chains, and the part that binds the antigen.",
                examWeight: 5,
                name: missed,
                prerequisites: [],
                reference: "Restarted board exam",
                syllabusLine: "Antibody structure",
                topics: ["Antibody structure"],
              },
            ],
            placements: [],
          },
          "google/gemini-3.8-flash",
        ),
      );

      // Research started again later read the notice; the learner tried again from their screen.
      await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });

      vi.mocked(getRun).mockImplementation(
        () =>
          ({
            createdAt: Promise.resolve(new Date()),
            exists: Promise.resolve(true),
            status: Promise.resolve("completed"),
          }) as never,
      );

      const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
      await goalContentWorkflow({ goalId: goal.id, researchId: "restarted-research" });

      const [plan, added, changes] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        prisma.skill.findFirstOrThrow({ where: { name: missed } }),
        prisma.planChange.findMany({ where: { plan: { goalId: goal.id } } }),
      ]);

      // The plan the learner has stays as it is: what the notice adds waits for their tap.
      expect(plan.graph).toStrictEqual(before.graph);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ kind: "edited", status: "proposed" });

      expect(changes[0]?.payload).toMatchObject({
        noticeGraph: {
          skills: expect.arrayContaining([expect.objectContaining({ skillId: added.id })]),
        },
        source: "notice",
      });

      // Every skill the plan had keeps its place in the proposed graph.
      const proposed = planWeightsSchema.parse(
        z.object({ noticeGraph: z.unknown() }).parse(changes[0]?.payload).noticeGraph,
      );

      expect(proposed.skills.map((skill) => skill.skillId)).toStrictEqual(
        expect.arrayContaining(
          planWeightsSchema.parse(before.graph).skills.map((skill) => skill.skillId),
        ),
      );
    },
  );

  it(
    "keeps waiting, less often, for research that reads a slow notice, then plans to its exam day",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({ details: { examName: "Slow board exam" }, kind: "exam" });
      const examDay = new Date(Date.now() + 90 * DAY_MS).toISOString().slice(0, 10);

      const blueprint = await examBlueprintFixture({
        edition: {
          citations: [],
          dates: [{ citation, date: examDay, kind: "exam", label: "Exam day" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: Number(examDay.slice(0, 4)),
        },
        name: "Slow board exam",
        structure: examStructure(["Vaccines"]),
      });

      vi.mocked(generateSkillGraph).mockResolvedValue(taskResult(graph));

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult({ examWeights: [], missing: [], placements: [] }, "google/gemini-3.8-flash"),
      );

      // Research outlasts the usual five minutes of polls, then links the notice it read.
      const usualPolls = 100;
      const polls = { count: 0 };

      vi.mocked(getRun).mockImplementation(() => {
        polls.count += 1;

        const status =
          polls.count <= usualPolls + 2
            ? Promise.resolve("running")
            : prisma.goal
                .update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } })
                .then(() => "completed");

        return { exists: Promise.resolve(true), status } as never;
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(vi.mocked(sleep)).toHaveBeenCalledWith("30s");

      const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(stored.targetDate?.toISOString().slice(0, 10)).toBe(examDay);
    },
  );

  it(
    "builds an exam's graph at once from its last edition, then checks the plan against the new notice research reads",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        examDate: new Date(Date.now() - 30 * DAY_MS),
        name: "Immunology board exam",
        structure: examStructure(["Vaccines"]),
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });
      const order: string[] = [];

      // The graph covers last edition's only topic, so the plan needs no check until the new one.
      vi.mocked(generateSkillGraph).mockImplementation(async () => {
        order.push("graph");
        return taskResult(withTopic({ graph, topic: "Vaccines" }));
      });

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult({ examWeights: [], missing: [], placements: [] }, "google/gemini-3.8-flash"),
      );

      // This year's notice added a topic.
      researchEndsWhenAsked(async () => {
        order.push("research ended");

        await prisma.examBlueprint.update({
          data: { structure: examStructure(["Vaccines", "Allergies"]) },
          where: { id: blueprint.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(order).toStrictEqual(["graph", "research ended"]);

      expect(
        vi.mocked(generateSkillGraph).mock.calls[0]?.[0].examBlueprint?.subjects,
      ).toMatchObject([{ name: "Immunology", topics: ["Vaccines"], weight: 1 }]);

      expect(getStreamedEvents().some((event) => event.step === "readExamNotice")).toBe(false);

      expect(checkCoverage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          references: [
            expect.objectContaining({
              text: expect.stringContaining("S1.1 Vaccines\n  S1.2 Allergies"),
            }),
          ],
        }),
      );
    },
  );

  it(
    "waits for the onboarding answers that shape the graph before building it",
    { timeout: TIMEOUT },
    async () => {
      const onboardingId = crypto.randomUUID();
      const { goal } = await newGoal({ details: { onboardingId, subject: "Vaccines" } });

      vi.mocked(sleep).mockImplementationOnce(async () => {
        expect(generateSkillGraph).not.toHaveBeenCalled();

        await prisma.goal.update({
          data: {
            details: {
              answered: ["purpose", "level"],
              level: "basic",
              onboardingId,
              purpose: "deep",
              subject: "Vaccines",
            },
          },
          where: { id: goal.id },
        });
      });

      await goalContentWorkflow({ goalId: goal.id });

      expect(vi.mocked(sleep)).toHaveBeenCalledWith("3s");

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0]).toMatchObject({
        ownLevel: "basic",
        purpose: "deep",
      });
    },
  );

  it("takes over a build a restart left half done, instead of joining it forever", async () => {
    const { goal } = await newGoal();

    // The run building the goal went to sleep for 3 seconds an hour ago and never woke up: a
    // server restart lost it. Cancelling it frees the goal's token.
    const cancel = vi.fn(() => {
      mockHookConflict(null);
      return Promise.resolve();
    });

    vi.mocked(getRun).mockImplementation(
      () =>
        ({
          cancel,
          exists: Promise.resolve(true),
          status: Promise.resolve("running"),
        }) as unknown as ReturnType<typeof getRun>,
    );

    const lastSign = new Date(Date.now() - 60 * 60 * 1000);

    mockLastRunEvent("stalled-build", {
      createdAt: lastSign,
      eventData: { resumeAt: new Date(lastSign.getTime() + 3000) },
      eventType: "wait_created",
    });

    mockHookConflict(
      { returnValue: new Promise(() => {}), runId: "stalled-build" },
      { tokens: new RegExp(`^goal-content:${goal.id}$`, "u") },
    );

    await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "built",
    });

    expect(cancel).toHaveBeenCalledOnce();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      generationRunId: "test-run-id",
    });
  });

  it("joins the run already building the goal, and never rebuilds a goal whose plan exists", async () => {
    const { goal } = await newGoal();
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "owner-run" });

    await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "joined",
    });

    // A joining run leaves the goal on the run already writing it.
    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      generationRunId: null,
    });

    mockHookConflict(null);

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Phase" }],
          skills: [
            {
              area: null,
              lessons: 1,
              name: "Skill",
              phase: 0,
              skillId: crypto.randomUUID(),
              weight: null,
            },
          ],
        },
      },
      where: { goalId: goal.id },
    });

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    await expect(goalContentWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateSkillGraph).not.toHaveBeenCalled();
  });

  it(
    "waits for a learn goal's research, then checks its graph against the syllabi it found",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal({ details: { level: "none", purpose: "deep" } });

      const syllabus = await sourceFixture({
        extractedText: "1. Antigens 2. Adaptive immunity 3. Vaccine trials",
        title: "Immunology course syllabus",
      });

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult({ examWeights: [], missing: [], placements: [] }, "google/gemini-3.8-flash"),
      );

      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      // Research links the syllabus it found while the graph waits.
      vi.mocked(sleep).mockImplementationOnce(async () => {
        await learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: syllabus.id,
          userId: user.id,
        });

        vi.mocked(getRun).mockReturnValue({
          exists: Promise.resolve(true),
          status: Promise.resolve("completed"),
        } as never);
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(vi.mocked(sleep)).toHaveBeenCalledWith("3s");

      expect(checkCoverage).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [
            {
              text: "1. Antigens 2. Adaptive immunity 3. Vaccine trials",
              title: "Immunology course syllabus",
            },
          ],
        }),
      );
    },
  );

  it(
    "writes original free-response questions with pointed rubric rows for an AP exam",
    { timeout: TIMEOUT },
    async () => {
      const blueprint = await examBlueprintFixture({
        identityKey: `ap-biology-${crypto.randomUUID()}`,
        name: "AP Biology",
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

      await goalContentWorkflow({ goalId: goal.id });

      const essayCalls = vi
        .mocked(generateItems)
        .mock.calls.filter(([params]) => params.format === "essay");

      expect(essayCalls.length).toBeGreaterThan(0);
      expect(essayCalls.length).toBeLessThanOrEqual(3);

      expect(essayCalls[0]?.[0]).toMatchObject({
        count: 1,
        examFormat: expect.objectContaining({ name: "AP Biology" }),
      });

      await expect(
        prisma.item.count({ where: { examBlueprintId: blueprint.id, format: "essay" } }),
      ).resolves.toBe(essayCalls.length);
    },
  );

  it("writes no free-response questions for other exams", { timeout: TIMEOUT }, async () => {
    const blueprint = await examBlueprintFixture({ name: "Immunology board exam" });
    const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

    await goalContentWorkflow({ goalId: goal.id });

    expect(vi.mocked(generateItems).mock.calls.some(([params]) => params.format === "essay")).toBe(
      false,
    );
  });

  it(
    "writes a learn goal's graph while research runs, and only its coverage check waits for research",
    { timeout: TIMEOUT },
    async () => {
      const { goal, user } = await newGoal({ details: { level: "none", purpose: "deep" } });
      const events: string[] = [];
      const { promise: graphWritten, resolve: markGraphWritten } = Promise.withResolvers<boolean>();

      const syllabus = await sourceFixture({
        extractedText: "1. Antigens 2. Adaptive immunity 3. Vaccine trials",
        title: "Immunology course syllabus",
      });

      vi.mocked(generateSkillGraph).mockImplementation(async () => {
        events.push("graph");
        markGraphWritten(true);
        return taskResult(graph);
      });

      vi.mocked(checkCoverage).mockResolvedValue(
        taskResult({ examWeights: [], missing: [], placements: [] }, "google/gemini-3.8-flash"),
      );

      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      // Research ends only after the graph is written, or after a few seconds for a graph that
      // waits for it, so the order shows which one waited.
      vi.mocked(sleep).mockImplementationOnce(async () => {
        await Promise.race([graphWritten, setTimeout(RESEARCH_LIMIT_MS)]);
        events.push("research ended");

        await learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: syllabus.id,
          userId: user.id,
        });

        vi.mocked(getRun).mockReturnValue({
          exists: Promise.resolve(true),
          status: Promise.resolve("completed"),
        } as never);
      });

      await goalContentWorkflow({ goalId: goal.id, researchId: "research-run" });

      expect(events).toStrictEqual(["graph", "research ended"]);

      expect(checkCoverage).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [
            {
              text: "1. Antigens 2. Adaptive immunity 3. Vaccine trials",
              title: "Immunology course syllabus",
            },
          ],
        }),
      );
    },
  );

  it(
    "rebuilds the curriculum from the notice the learner uploaded, without writing ahead again",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({ kind: "exam" });
      await goalContentWorkflow({ goalId: goal.id });

      // Research read the learner's upload into the exam's blueprint after the plan was built.
      const blueprint = await examBlueprintFixture({ name: "Immunology board exam" });

      await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });

      vi.mocked(generateSkillGraph).mockClear();
      vi.mocked(generateItems).mockClear();
      vi.mocked(generatePlacementItems).mockClear();
      getStartMock().mockClear();

      await expect(goalContentWorkflow({ goalId: goal.id, rebuild: true })).resolves.toStrictEqual({
        goalId: goal.id,
        speculativeLessonIds: [],
        status: "built",
      });

      expect(vi.mocked(createHook)).toHaveBeenCalledWith({ token: `goal-rebuild:${goal.id}` });

      expect(vi.mocked(generateSkillGraph).mock.calls[0]?.[0]).toMatchObject({
        examBlueprint: expect.objectContaining({ name: "Immunology board exam" }),
      });

      // Placement is behind the learner, so nothing is written ahead for it.
      expect(generateItems).not.toHaveBeenCalled();
      expect(generatePlacementItems).not.toHaveBeenCalled();

      expect(
        getStartMock().mock.calls.some(([workflow]) => workflow === lessonContentWorkflow),
      ).toBe(false);
    },
  );

  it(
    "writes practice set in a work learner's field for the first phase, next to placement",
    { timeout: TIMEOUT },
    async () => {
      const { goal } = await newGoal({
        details: { level: "none", purpose: "work", role: "ICU nurse", tasks: "Shift reports" },
      });

      vi.mocked(classifyWorkField).mockResolvedValue(taskResult({ field: "nursing" as const }));

      // Each real call is its own run; items of one run on one skill are stored once.
      vi.mocked(generateItems).mockImplementation(async (params) => placementItemsFor(params));

      await goalContentWorkflow({ goalId: goal.id });

      expect(classifyWorkField).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "work", role: "ICU nurse", tasks: "Shift reports" }),
      );

      const fieldCalls = vi
        .mocked(generateItems)
        .mock.calls.filter(([params]) => params.field === "nursing");

      const firstPhase = graph.skills.filter((skill) => skill.phase === graph.skills[0]?.phase);
      expect(fieldCalls).toHaveLength(Math.min(firstPhase.length, 8));

      const [stored, plan] = await Promise.all([
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ]);

      const { skills } = plan.graph as { skills: { skillId: string }[] };

      const fieldItems = await prisma.item.count({
        where: { field: "nursing", skillId: { in: skills.map((skill) => skill.skillId) } },
      });

      expect(stored.details).toMatchObject({ field: "nursing", role: "ICU nurse" });
      expect(fieldItems).toBe(fieldCalls.length);
    },
  );

  it(
    "copies real questions from an exam's past papers when the organizer allows it",
    { timeout: TIMEOUT },
    async () => {
      const paperText =
        "QUESTÃO 91\nUma vacina protege 90 de 100 pessoas.\nQual é a eficácia?\nA 90%\nB 10%";

      const paper = await sourceFixture({
        extractedText: paperText,
        publisher: "Inep",
        title: "Enem 2023",
        url: `https://download.inep.gov.br/${crypto.randomUUID()}.pdf`,
      });

      const blueprint = await examBlueprintFixture({
        name: "Enem",
        structure: {
          formats: [
            {
              citation: { passage: "Duas alternativas.", sourceId: paper.id },
              description: "Múltipla escolha",
              kind: "multipleChoice",
              options: 2,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
        topicFrequency: [
          {
            appearances: 1,
            basis: "1 de 45",
            citation: { passage: "Vacinas.", sourceId: paper.id },
            level: "high",
            subject: "Biologia",
            topic: "Vacinas",
          },
        ],
      });

      const { goal } = await newGoal({ examBlueprintId: blueprint.id, kind: "exam" });

      vi.mocked(extractPastQuestions).mockResolvedValue(
        taskResult(
          {
            questions: [
              {
                citation: "Enem 2023, questão 91",
                item: {
                  context: "Uma vacina protege 90 de 100 pessoas.",
                  difficulty: "easy" as const,
                  format: "multipleChoice" as const,
                  image: null,
                  options: [
                    { isCorrect: true, misconception: null, reason: "Certo.", text: "90%" },
                    {
                      isCorrect: false,
                      misconception: "Confunde com quem não fica protegido",
                      reason: "Errado.",
                      text: "10%",
                    },
                  ],
                  question: "Qual é a eficácia?",
                  visual: null,
                },
                number: "91",
                skill: 1,
              },
            ],
          },
          "google/gemini-3.8-flash",
        ),
      );

      await goalContentWorkflow({ goalId: goal.id });

      expect(extractPastQuestions).toHaveBeenCalledWith(
        expect.objectContaining({ exam: "Enem", paper: { text: paperText, title: "Enem 2023" } }),
      );

      await expect(
        prisma.item.findMany({ where: { examBlueprintId: blueprint.id, sourceId: paper.id } }),
      ).resolves.toStrictEqual([
        expect.objectContaining({ sourceCitation: "Enem 2023, questão 91" }),
      ]);
    },
  );

  it("leaves a goal still being built to its first run", async () => {
    const { goal } = await newGoal();

    await expect(goalContentWorkflow({ goalId: goal.id, rebuild: true })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateSkillGraph).not.toHaveBeenCalled();
  });
});
