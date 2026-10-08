import { randomUUID } from "node:crypto";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { decidePlanChange } from "../plans/decide-plan-change";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { claimLessonQuestionAnswer, completeLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";
import { proposeTutorPlanChange } from "./propose-tutor-plan-change";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; asking the tutor sends an event.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** Reading the learner's words is the one model call here; each test says what it understood. */
vi.mock("@zoonk/ai/tasks/v2/plans/edit-intent", () => ({ interpretPlanEdit: vi.fn() }));

/** Finding a topic's Library skill asks models for search terms and a verdict; the search is real. */
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, so estimates stay put. */
const NOW = new Date("2020-09-28T12:00:00Z");

const ANSWER_RUN = {
  answer: "Prepared it: tap Apply when you're ready.",
  finishReason: "stop",
  generatedAt: NOW.toISOString(),
  model: "google/gemini-3.8-flash",
  promptVersion: "goal-tutor-test",
  provider: "google",
  runId: "run-goal-tutor",
};

function mockWords(data: Awaited<ReturnType<typeof interpretPlanEdit>>["data"]) {
  vi.mocked(interpretPlanEdit).mockResolvedValue({
    data,
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "google",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: "run-plan-words",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Math", lessons: 8 },
      { area: "Biology", lessons: 6 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

/** The learner asks the buddy something, and the answer's generation claims it. */
async function askBuddy({ goalId, question }: { goalId: string; question: string }) {
  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question, requestId: randomUUID() },
    target: { goalId, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  const claimed = await claimLessonQuestionAnswer({
    questionId: created.question.id,
    requestedModel: () => ANSWER_RUN.model,
  });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a claimed answer, received ${claimed.status}`);
  }

  return {
    analytics: claimed.claim.analytics,
    questionId: created.question.id,
    revision: claimed.claim.revision,
  };
}

async function readThread(goalId: string) {
  const result = await getLessonQuestionThread({
    contextKind: "plan",
    target: { goalId, kind: "plan" },
  });

  return result.status === "ready" ? (result.thread?.questions ?? []) : [];
}

/** The buddy proposes a change in an answer the learner asked for, and the answer is saved. */
async function proposeInAnswer({
  goalId,
  operations,
  question,
  summary,
}: {
  goalId: string;
  operations: Parameters<typeof mockWords>[0]["operations"];
  question: string;
  summary: string;
}) {
  mockWords({ leftOut: [], operations, summary, understood: true });
  const asked = await askBuddy({ goalId, question });
  const result = await proposeTutorPlanChange({ ...asked, request: question });
  await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });

  if (result.status !== "proposed") {
    throw new Error(`Expected a proposal, received ${result.status}`);
  }

  return result.change.id;
}

function readStatuses(ids: string[]) {
  return prisma.planChange.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
    where: { id: { in: ids } },
  });
}

describe("plan changes the buddy proposes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the buddy's answer for the learner and the goal, so its cost is theirs", async () => {
    const { goal, user } = await setup();
    const { analytics } = await askBuddy({ goalId: goal.id, question: "why this lesson today?" });

    expect(analytics).toStrictEqual({ distinctId: user.id, goalId: goal.id });
  });

  it("frees a rest day the learner asks for: the week's challenges move to a study day, as the card says", async () => {
    const user = await userFixture();
    // Weeks of lessons, so the plan has weekly challenges ahead.
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 60 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const before = await prisma.planItem.findMany({
      where: { kind: "checkpoint", planId: plan.id, status: "todo" },
    });

    // The weekly challenge is on Sundays while the learner studies every day.
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((item) => item.scheduledFor?.getUTCDay() === 0)).toBe(true);

    mockWords({
      leftOut: [],
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      summary: "Sundays stay free.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Sunday is my rest day" });
    const result = await proposeTutorPlanChange({ ...asked, request: "Sunday is a rest day" });

    expect(result).toMatchObject({
      change: { effect: { weeklyEvents: { after: 6, before: 0, kind: "challenge" } } },
      status: "proposed",
    });

    const changeId = result.status === "proposed" ? result.change.id : "";
    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const after = await prisma.planItem.findMany({
      where: { kind: { in: ["checkpoint", "mock", "boss"] }, planId: plan.id, status: "todo" },
    });

    const weekly = after.filter((item) => item.kind === "checkpoint");

    expect(weekly.length).toBeGreaterThan(0);
    expect(weekly.every((item) => item.scheduledFor?.getUTCDay() === 6)).toBe(true);
    expect(after.filter((item) => item.scheduledFor?.getUTCDay() === 0)).toStrictEqual([]);
  });

  it("adds the topics the learner asks for among their next skills, which the Library then writes", async () => {
    const { goal, library, plan } = await setup();
    const word = uniqueWord();

    mockSearchTerms([word]);
    mockDecision(null);

    mockWords({
      leftOut: [],
      operations: [
        {
          kind: "addTopics",
          topics: [
            {
              area: "Math",
              description: "Read a dashboard's numbers and say what they mean.",
              name: `Read dashboards ${word}`,
            },
          ],
        },
      ],
      summary: "Dashboards come into your plan.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "add dashboards to my plan" });
    const result = await proposeTutorPlanChange({ ...asked, request: "add dashboards" });

    expect(result).toMatchObject({ change: { effect: { lessonsAdded: 8 } }, status: "proposed" });

    const changeId = result.status === "proposed" ? result.change.id : "";
    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const skill = await prisma.skill.findFirstOrThrow({
      where: { name: `Read dashboards ${word}` },
    });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const graph = stored.graph as { skills: { area: string | null; skillId: string }[] };

    // The learner hasn't started the plan: the topic comes in among its skills, in Math, after
    // the one they start next instead of ahead of everything (Marcos got 19 field lessons before
    // his interview basics).
    const [first, ...rest] = library.graph.skills.map((entry) => entry.skillId);
    expect(graph.skills.map((entry) => entry.skillId)).toStrictEqual([first, skill.id, ...rest]);
    expect(graph.skills[1]?.area).toBe("Math");

    // Its 8 lessons wait as a stand-in until the Library outlines them.
    await expect(
      prisma.planItem.count({
        where: { kind: "lesson", lessonId: null, planId: plan.id, skillId: skill.id },
      }),
    ).resolves.toBe(1);
  });

  it("spreads several added topics through what the learner hasn't started", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: Array.from({ length: 6 }, () => ({ area: "Math", lessons: 2 })),
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const word = uniqueWord();
    const names = ["SQL", "dashboards", "stakeholders"].map((name) => `${name} ${word}`);

    mockSearchTerms([word]);
    mockDecision(null);

    mockWords({
      leftOut: [],
      operations: [
        {
          kind: "addTopics",
          topics: names.map((name) => ({ area: "Math", description: `${name}.`, name })),
        },
      ],
      summary: "Three field topics come into your plan.",
      understood: true,
    });

    const asked = await askBuddy({
      goalId: goal.id,
      question: "add SQL, dashboards, stakeholders",
    });

    const result = await proposeTutorPlanChange({ ...asked, request: "add my field's topics" });
    const changeId = result.status === "proposed" ? result.change.id : "";

    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const graph = stored.graph as { skills: { name: string }[] };
    const order = graph.skills.map((entry) => entry.name);
    const positions = names.map((name) => order.indexOf(name));

    // Each topic comes after some of the plan's own skills, none of them next to another.
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions.toSorted((a, b) => a - b)).toStrictEqual(positions);

    const gaps = positions.slice(1).map((position, index) => position - (positions[index] ?? 0));
    expect(gaps.every((gap) => gap > 1)).toBe(true);
  });

  it("waits for the learner's tap even for a small change, then applies it", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    mockWords({
      leftOut: [],
      operations: [{ kind: "setDailyMinutes", minutes: 13 }],
      summary: "Your daily time goes up to 13 minutes.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Can I study 13 minutes a day?" });

    const result = await proposeTutorPlanChange({ ...asked, request: "Study 13 minutes a day" });

    // The card says what the change does, from its operations and effect, never the model's
    // summary of what was asked.
    expect(result).toMatchObject({
      change: {
        operations: [{ kind: "setDailyMinutes", minutes: 13 }],
        reason: null,
        source: "planEdit",
        status: "proposed",
      },
      status: "proposed",
    });

    expect(interpretPlanEdit).toHaveBeenCalledWith(
      expect.objectContaining({ dailyMinutes: 12, request: "Study 13 minutes a day" }),
    );

    // Nothing moved: the plan and the goal stay as they were until the learner says yes.
    const [planAfter, goalAfter] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(planAfter.version).toBe(before.version);
    expect(goalAfter.dailyMinutes).toBe(12);

    const changeId = result.status === "proposed" ? result.change.id : "";

    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });

    // The conversation shows the proposal under the answer that made it.
    await expect(readThread(goal.id)).resolves.toMatchObject([
      {
        answer: ANSWER_RUN.answer,
        planChange: { id: changeId, status: "proposed" },
        status: "completed",
      },
    ]);

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 13,
    });

    await expect(readThread(goal.id)).resolves.toMatchObject([
      { planChange: { canUndo: true, id: changeId, status: "applied" } },
    ]);
  });

  it("fills in what the words leave open from the learner's goals and routine", async () => {
    const { goal, user } = await setup();

    // An adult with memory on: minors' and unknown ages' memory holds only goals and learning.
    await Promise.all([
      learningProfileFixture({
        birthMonth: 1,
        birthYear: 1990,
        memoryEnabled: true,
        userId: user.id,
      }),
      memoryFactFixture({ category: "routine", statement: "Busy on Saturdays", userId: user.id }),
      memoryFactFixture({
        category: "goals",
        statement: "Wants to finish by June",
        userId: user.id,
      }),
      memoryFactFixture({ category: "background", statement: "Works as a nurse", userId: user.id }),
    ]);

    mockWords({
      leftOut: [],
      operations: [{ kind: "setWeekdayMinutes", minutes: 10, weekdays: [6] }],
      summary: "Saturdays go down to 10 minutes.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "less on my busy day" });
    await proposeTutorPlanChange({ ...asked, request: "less on my busy day" });

    expect(interpretPlanEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        memory: expect.arrayContaining(["Busy on Saturdays", "Wants to finish by June"]),
        request: "less on my busy day",
      }),
    );

    const last = vi.mocked(interpretPlanEdit).mock.lastCall?.[0];
    expect(last?.memory).not.toContain("Works as a nurse");
    expect(last?.purpose).toBeUndefined();
  });

  it("replaces a waiting proposal when a newer one changes the same thing, and says so", async () => {
    const { goal } = await setup();

    const saturdays = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
      question: "No study on Saturdays",
      summary: "Saturdays are off.",
    });

    const sundays = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      question: "Actually, Sundays off instead",
      summary: "Sundays are off.",
    });

    await expect(readStatuses([saturdays, sundays])).resolves.toStrictEqual([
      { id: saturdays, status: "replaced" },
      { id: sundays, status: "proposed" },
    ]);

    // The earlier card says it was replaced; it can't be applied any more.
    const thread = await readThread(goal.id);

    expect(thread.map((question) => question.planChange?.status)).toStrictEqual([
      "replaced",
      "proposed",
    ]);

    await expect(
      decidePlanChange({
        changeId: saturdays,
        goalId: goal.id,
        input: { status: "applied", timeZone: "UTC" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("keeps every earlier proposal answerable while newer ones change other things", async () => {
    const { goal } = await setup();

    const saturdays = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
      question: "No study on Saturdays",
      summary: "Saturdays are off.",
    });

    const biology = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ areas: ["Biology"], kind: "focusAreas" }],
      question: "More Biology, please",
      summary: "Biology gets priority.",
    });

    await expect(readStatuses([saturdays, biology])).resolves.toStrictEqual([
      { id: saturdays, status: "proposed" },
      { id: biology, status: "proposed" },
    ]);

    // The learner answers the older one first; the newer one still waits for its own answer.
    await expect(
      decidePlanChange({
        changeId: saturdays,
        goalId: goal.id,
        input: { status: "applied", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ change: { status: "applied" }, status: "updated" });

    await expect(
      decidePlanChange({
        changeId: biology,
        goalId: goal.id,
        input: { status: "applied", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ change: { status: "applied" }, status: "updated" });
  });

  it("replaces a waiting proposal when the learner changes the same thing themselves", async () => {
    const { goal } = await setup();

    const hour = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 60 }],
      question: "One hour a day",
      summary: "One hour a day.",
    });

    const biology = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ areas: ["Biology"], kind: "focusAreas" }],
      question: "More Biology, please",
      summary: "Biology gets priority.",
    });

    // The plan's own controls set the time: the buddy's hour no longer means anything.
    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 20, weekdays: [1, 2, 3, 4, 5] }],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(readStatuses([hour, biology])).resolves.toStrictEqual([
      { id: hour, status: "replaced" },
      { id: biology, status: "proposed" },
    ]);
  });

  it("changes nothing when the words aren't a plan change", async () => {
    const { goal, plan } = await setup();
    mockWords({ leftOut: [], operations: [], summary: "", understood: false });

    const asked = await askBuddy({ goalId: goal.id, question: "What is a fraction?" });

    await expect(
      proposeTutorPlanChange({ ...asked, request: "What is a fraction?" }),
    ).resolves.toStrictEqual({ status: "notUnderstood" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  it("never offers a change that would leave the plan as it is", async () => {
    const { goal, plan } = await setup();

    // Math already comes first and every lesson fits: putting it first moves nothing.
    mockWords({
      leftOut: [],
      operations: [{ areas: ["Math"], kind: "focusAreas" }],
      summary: "Math comes first in your plan.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Put math first" });

    await expect(
      proposeTutorPlanChange({ ...asked, request: "Put math first" }),
    ).resolves.toStrictEqual({ leftOut: [], status: "unchanged" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  it("never offers a no-op while the Library outlines lessons the plan hasn't taken in yet", async () => {
    const user = await userFixture();

    // Biology isn't outlined yet: the plan holds it as a stand-in of 6 lessons.
    const library = await planLibraryFixture({
      skills: [
        { area: "Math", lessons: 8 },
        { area: "Biology", lessons: 0, size: 6 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    // The Library outlines Biology afterwards; the stored plan still has its stand-in.
    const chapterId = library.chapters[0]?.id ?? "";

    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: 4,
          homeChapterId: chapterId,
          title: `Biology outlined ${index} ${randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 900 + index }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: library.skills[1]?.id ?? "" }),
        ]);
      }),
    );

    // Math already comes first: asking for it changes nothing, whatever the Library wrote since.
    mockWords({
      leftOut: [],
      operations: [{ areas: ["Math"], kind: "focusAreas" }],
      summary: "Math comes first in your plan.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Put math first" });

    await expect(
      proposeTutorPlanChange({ ...asked, request: "Put math first" }),
    ).resolves.toStrictEqual({ leftOut: [], status: "unchanged" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  it("says what the change itself does, not what the Library's new lessons do", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Math", lessons: 8 },
        { area: "Biology", lessons: 0, size: 6 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const chapterId = library.chapters[0]?.id ?? "";

    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: 3,
          homeChapterId: chapterId,
          title: `Biology written ${index} ${randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 900 + index }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: library.skills[1]?.id ?? "" }),
        ]);
      }),
    );

    // Twice the time a day: no lesson comes or goes, the plan only ends sooner.
    mockWords({
      leftOut: [],
      operations: [{ kind: "setDailyMinutes", minutes: 24 }],
      summary: "Twenty-four minutes a day.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "24 minutes a day" });
    const result = await proposeTutorPlanChange({ ...asked, request: "24 minutes a day" });

    expect(result.status).toBe("proposed");

    expect(result.status === "proposed" && result.change.effect).toMatchObject({
      lessonsAdded: 0,
      lessonsRemoved: 0,
    });
  });

  it("knows what the exam's notice says, and says the notice's day with a change that moves off it", async () => {
    const user = await userFixture();
    const citation = { passage: "", sourceId: "notice" };

    const [blueprint, library] = await Promise.all([
      examBlueprintFixture({
        edition: {
          citations: [],
          dates: [
            { citation, date: "2020-10-05", kind: "registrationEnd", label: "Registration ends" },
            { citation, date: "2021-01-10", kind: "exam", label: "First phase" },
          ],
          noticeUrl: "https://exam.test/notice.pdf",
          questionCount: 80,
          sourceHash: null,
          year: 2020,
        },
        name: "Bar exam",
        structure: {
          formats: [],
          mock: null,
          rules: [{ citation, text: "Passing takes 40 of the 80 questions." }],
          subjects: [
            { citation, name: "Ethics", questions: 8, topics: [], weight: null },
            { citation, name: "Constitutional law", questions: 6, topics: [], weight: null },
          ],
        },
      }),
      planLibraryFixture({ skills: [{ area: "Ethics", lessons: 4 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      details: { targetScore: "60" },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2021-01-10T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const asked = await askBuddy({ goalId: goal.id, question: "I'll take the March exam instead" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: asked.questionId },
    });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      exam: {
        days: [{ date: "2021-01-10", label: "First phase" }],
        name: "Bar exam",
        official: true,
        otherDates: [{ date: "2020-10-05", label: "Registration ends" }],
        questionCount: 80,
        rules: ["Passing takes 40 of the 80 questions."],
        source: "https://exam.test/notice.pdf",
        subjects: [
          { group: null, name: "Ethics", questions: 8 },
          { group: null, name: "Constitutional law", questions: 6 },
        ],
      },
      goal: { target: "60", targetDate: "2021-01-10" },
    });

    mockWords({
      leftOut: [],
      operations: [{ kind: "setTargetDate", targetDate: "2021-03-31" }],
      summary: "The exam date moves to March.",
      understood: true,
    });

    const moved = await proposeTutorPlanChange({ ...asked, request: "Exam in March" });

    expect(moved).toMatchObject({
      change: {
        officialDate: { date: "2021-01-10", source: "https://exam.test/notice.pdf" },
        status: "proposed",
      },
      status: "proposed",
    });

    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });

    // Another change says nothing of the notice's day.
    mockWords({
      leftOut: ["aim for 60 points"],
      operations: [{ kind: "setDailyMinutes", minutes: 30 }],
      summary: "Thirty minutes a day.",
      understood: true,
    });

    const again = await askBuddy({ goalId: goal.id, question: "30 minutes, and aim for 60" });

    await expect(
      proposeTutorPlanChange({ ...again, request: "30 minutes a day, and aim for 60 points" }),
    ).resolves.toMatchObject({
      change: { officialDate: null, status: "proposed" },
      leftOut: ["aim for 60 points"],
      status: "proposed",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(2);
  });

  it("knows a class test's facts come from the learner's material, whose day is never a notice's", async () => {
    const user = await userFixture();
    const citation = { passage: "Prova: sexta, 2/10", sourceId: "slides" };

    const [material, library] = await Promise.all([
      examBlueprintFixture({
        edition: {
          citations: [],
          dates: [{ citation, date: "2020-10-02", kind: "exam", label: "Biology test" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: 2020,
        },
        name: "Biology test",
        ownerId: user.id,
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [{ citation, name: "Cells", questions: null, topics: [], weight: null }],
        },
        visibility: "private",
      }),
      planLibraryFixture({ skills: [{ area: "Cells", lessons: 4 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      examBlueprintId: material.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-02T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const asked = await askBuddy({ goalId: goal.id, question: "The test moved to Monday" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: asked.questionId },
    });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      exam: { days: [{ date: "2020-10-02" }], fromMaterial: true, official: false },
    });

    mockWords({
      leftOut: [],
      operations: [{ kind: "setTargetDate", targetDate: "2020-10-05" }],
      summary: "The test moves to Monday.",
      understood: true,
    });

    // The learner's own date needs no "keep the notice's date": there's no notice.
    await expect(
      proposeTutorPlanChange({ ...asked, request: "The test is on Monday now" }),
    ).resolves.toMatchObject({ change: { officialDate: null }, status: "proposed" });
  });

  // Pedro asked the day before his class test's full review for "only osmosis and organelles
  // tomorrow": the card has to say the review starts with them, since no lesson moves.
  it("says a class test's review day ahead starts with the topics the learner focuses on", async () => {
    const user = await userFixture();

    const [material, library] = await Promise.all([
      examBlueprintFixture({
        name: "Biology test",
        ownerId: user.id,
        structure: { formats: [], mock: null, rules: [], subjects: [] },
        visibility: "private",
      }),
      planLibraryFixture({
        skills: [
          { area: "Cells", lessons: 2 },
          { area: "Cells", lessons: 2 },
          { area: "Cells", lessons: 2 },
        ],
      }),
    ]);

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      examBlueprintId: material.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-09-30T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const chosen = library.skills.slice(1).map((skill) => skill.id);

    mockWords({
      leftOut: ["treinar a dissertativa"],
      operations: [
        {
          areas: ["Cells"],
          kind: "focusAreas",
          parts: [{ area: "Cells", name: "Osmosis and organelles", skillIds: chosen }],
        },
      ],
      summary: "Osmosis and organelles come first.",
      understood: true,
    });

    const request = "amanhã só osmose e organelas";
    const asked = await askBuddy({ goalId: goal.id, question: request });
    const result = await proposeTutorPlanChange({ ...asked, request });

    expect(result).toMatchObject({
      change: {
        effect: { reviewFirst: { areas: ["Osmosis and organelles"], date: "2020-09-29" } },
      },
      leftOut: ["treinar a dissertativa"],
      status: "proposed",
    });
  });

  it("reads which topics a focus on a one-subject plan means from the learner's words", async () => {
    const user = await userFixture();

    const [material, library] = await Promise.all([
      examBlueprintFixture({
        name: "Biology test",
        ownerId: user.id,
        structure: { formats: [], mock: null, rules: [], subjects: [] },
        visibility: "private",
      }),
      planLibraryFixture({
        skills: [
          { area: "Biologia", lessons: 2 },
          { area: "Biologia", lessons: 2 },
          { area: "Biologia", lessons: 2 },
        ],
      }),
    ]);

    const [virus, osmosis, organelles] = library.graph.skills;

    const graph = {
      ...library.graph,
      skills: [
        { ...virus, name: "Caracterizar a estrutura dos vírus", topics: ["Vírus"] },
        { ...osmosis, name: "Analisar transporte passivo e osmose", topics: ["Membrana"] },
        { ...organelles, name: "Explicar funções de ribossomos", topics: ["Organelas"] },
      ].flatMap((skill) => (skill.skillId ? [skill] : [])),
    };

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      examBlueprintId: material.id,
      kind: "exam",
      language: "pt",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-09-30T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: graph as typeof library.graph });
    mockSession(user.id);

    // The model read the focus as the whole of the plan's only subject, which changes nothing.
    mockWords({
      leftOut: [],
      operations: [{ areas: ["Biologia"], kind: "focusAreas", parts: [] }],
      summary: "Osmose e organelas vêm primeiro amanhã.",
      understood: true,
    });

    const request = "amanhã quero estudar osmose e organelas";
    const asked = await askBuddy({ goalId: goal.id, question: request });
    const result = await proposeTutorPlanChange({ ...asked, request });

    expect(result).toMatchObject({
      change: {
        operations: [
          {
            areas: ["Biologia"],
            kind: "focusAreas",
            parts: [
              {
                area: "Biologia",
                name: "Osmose e organelas",
                skillIds: [osmosis?.skillId, organelles?.skillId],
              },
            ],
          },
        ],
      },
      status: "proposed",
    });
  });

  it("says when a focused area starts with the change", async () => {
    const { goal } = await setup();

    mockWords({
      leftOut: [],
      operations: [{ areas: ["Biology"], kind: "focusAreas" }],
      summary: "Biology gets priority.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Biology first" });
    const result = await proposeTutorPlanChange({ ...asked, request: "Biology first" });
    const starts = result.status === "proposed" ? result.change.effect?.areaStarts : null;

    // Biology moves ahead of Math, so it starts sooner than it did.
    expect(starts).toHaveLength(1);
    expect(starts?.[0]?.area).toBe("Biology");
    expect(starts?.[0]?.after?.localeCompare(starts[0].before ?? "")).toBeLessThan(0);
  });

  it("gives less time to a subject the learner wants less of, and the buddy sees it after Apply", async () => {
    const { goal, plan } = await setup();

    const changeId = await proposeInAnswer({
      goalId: goal.id,
      operations: [{ areas: ["Math"], kind: "reduceAreas" }],
      question: "less math, please",
      summary: "Math gets less time.",
    });

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: changeId } }),
    ).resolves.toMatchObject({
      payload: { operations: [{ areas: ["Math"], kind: "reduceAreas" }] },
      status: "proposed",
    });

    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.settings).toMatchObject({ focusAreas: [], reducedAreas: ["Math"] });

    const asked = await askBuddy({ goalId: goal.id, question: "How is my plan now?" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: asked.questionId },
    });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      setup: {
        areas: [
          { focused: false, name: "Math", reduced: true },
          { focused: false, name: "Biology", reduced: false },
        ],
      },
    });
  });

  it("only lets the generation answering the learner's own question propose", async () => {
    const [{ goal, plan }, other] = await Promise.all([setup(), userFixture()]);

    mockWords({
      leftOut: [],
      operations: [{ kind: "setDailyMinutes", minutes: 20 }],
      summary: "Twenty minutes a day.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "20 minutes a day" });

    // An earlier revision lost its claim to a retry; it can't ask for anything anymore.
    await expect(
      proposeTutorPlanChange({
        ...asked,
        request: "20 minutes a day",
        revision: asked.revision - 1,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(other.id);

    await expect(
      proposeTutorPlanChange({ ...asked, request: "20 minutes a day" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(
      proposeTutorPlanChange({ ...asked, request: "20 minutes a day" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    expect(interpretPlanEdit).not.toHaveBeenCalled();
  });

  it("sees how the learner shaped the plan and their latest open mistakes", async () => {
    const { goal, library, user } = await setup();

    await mistakeFixture({
      skillId: library.skills[0]?.id ?? null,
      snapshot: { answer: "1/3", correctAnswer: "1/2", question: "Half of one is?" },
      userId: user.id,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Explain my mistake" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: asked.questionId },
    });

    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      mistakes: [
        {
          answer: "1/3",
          correctAnswer: "1/2",
          question: "Half of one is?",
          skill: library.skills[0]?.name,
        },
      ],
      scope: { kind: "plan" },
      setup: {
        areas: [
          { focused: false, name: "Math", skipped: false },
          { focused: false, name: "Biology", skipped: false },
        ],
        weekdayMinutes: [12, 12, 12, 12, 12, 12, 12],
      },
    });
  });

  it("starts one subject past its basics when its lessons are too basic", async () => {
    const user = await userFixture();

    // English goes on past its basics; Law sits in one phase, so all of it is what the goal asks.
    const library = await planLibraryFixture({
      phases: ["Basics", "Deeper"],
      skills: [
        { area: "English", lessons: 3, phase: 0 },
        { area: "English", lessons: 3, phase: 1 },
        { area: "Law", lessons: 3, phase: 0 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    mockWords({
      leftOut: [],
      operations: [{ areas: ["English"], kind: "setAreaStart", start: "pastBasics" }],
      summary: "English starts past the basics.",
      understood: true,
    });

    const asked = await askBuddy({
      goalId: goal.id,
      question: "The English lessons are too basic",
    });

    const result = await proposeTutorPlanChange({
      ...asked,
      request: "Start English past the basics",
    });

    expect(result).toMatchObject({
      cautions: [],
      change: { effect: { lessonsAdded: 0, lessonsRemoved: 3 }, status: "proposed" },
      status: "proposed",
    });

    const changeId = result.status === "proposed" ? result.change.id : "";
    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });
    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const [planAfter, todo] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.planItem.findMany({
        select: { skillId: true },
        where: { kind: "lesson", planId: plan.id, status: "todo" },
      }),
    ]);

    const skillIds = new Set(todo.map((item) => item.skillId));

    expect(planAfter.settings).toMatchObject({ pastBasicsAreas: ["English"] });
    expect(skillIds.has(library.skills[0]?.id ?? "")).toBe(false);
    expect(skillIds.has(library.skills[1]?.id ?? "")).toBe(true);
    expect(skillIds.has(library.skills[2]?.id ?? "")).toBe(true);

    // Law has no basics apart from what it asks: starting it past them moves nothing.
    mockWords({
      leftOut: [],
      operations: [{ areas: ["Law"], kind: "setAreaStart", start: "pastBasics" }],
      summary: "Law starts past the basics.",
      understood: true,
    });

    const again = await askBuddy({ goalId: goal.id, question: "Law is too basic too" });

    await expect(
      proposeTutorPlanChange({ ...again, request: "Start Law past the basics" }),
    ).resolves.toStrictEqual({ leftOut: [], status: "unchanged" });
  });

  it("says what leaving out an exam subject with questions costs before the learner applies it", async () => {
    const user = await userFixture();

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: ["Math", "Biology"].map((name) => ({
          citation: { passage: "Conteúdo programático", sourceId: "notice" },
          name,
          questions: 45,
          topics: [],
          weight: null,
        })),
      },
    });

    const library = await planLibraryFixture({
      skills: [
        { area: "Math", lessons: 4 },
        { area: "Biology", lessons: 4 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2021-03-01T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    mockWords({
      leftOut: [],
      operations: [{ areas: ["Math"], kind: "skipAreas" }],
      summary: "Math leaves your plan.",
      understood: true,
    });

    const asked = await askBuddy({ goalId: goal.id, question: "Take math out of my plan" });
    const result = await proposeTutorPlanChange({ ...asked, request: "Leave Math out" });

    expect(result).toMatchObject({
      cautions: [{ area: "Math", kind: "leavesOutExamSubject", questions: 45 }],
      status: "proposed",
    });
  });
});
