import { classifyQuestionGenerality } from "@zoonk/ai/tasks/v2/explain/question-generality";
import {
  type QuickExplanation,
  generateQuickExplanation,
} from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { explainQuestionWorkflow } from "./explain-question-workflow";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Model calls are external: generality, identity search and the explanation itself.
vi.mock("@zoonk/ai/tasks/v2/explain/question-generality", () => ({
  classifyQuestionGenerality: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/explain/quick-explanation", () => ({
  generateQuickExplanation: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

function explanation(courseTitle: string): QuickExplanation {
  return {
    check: {
      options: [
        {
          feedback: "Yes: the index is a basket of stocks.",
          isCorrect: true,
          text: "The basket is worth 2% more",
        },
        {
          feedback: "No: most stocks can fall on an up day.",
          isCorrect: false,
          text: "Every stock rose 2%",
        },
        {
          feedback: "No: points are only the index's unit.",
          isCorrect: false,
          text: "It gained 2 points",
        },
      ],
      question: "The market is up 2% today. What happened?",
    },
    goFurther: {
      overviewCourse: courseTitle,
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    },
    recap: [
      "The market is an index.",
      "Big companies weigh more.",
      "Up 2% compares with yesterday.",
    ],
    screens: [
      {
        imagePrompt: null,
        text: "“The market” is an **index**.",
        title: "The market isn't one price",
      },
      {
        imagePrompt: null,
        text: "Each company counts by its size.",
        title: "Bigger companies weigh more",
      },
      {
        imagePrompt: null,
        text: "It compares now with yesterday's close.",
        title: "Up 2% since when?",
      },
      {
        imagePrompt: null,
        text: "An index fund follows the basket.",
        title: "Why it matters to you",
      },
    ],
    title: "What “the market is up 2%” means",
  };
}

async function explainGoal(question: string) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { question },
    kind: "explain",
    prompt: question,
    userId: user.id,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  return { goal, user };
}

/** How long a test waits for work running side by side, which a busy test database slows down. */
const SIDE_BY_SIDE = { timeout: 4000 };

/**
 * Waits until the learner can read the goal's explanation: it's on the goal's plan and the stream
 * said writing is done.
 */
async function waitUntilReadable(goalId: string): Promise<void> {
  await vi.waitFor(async () => {
    const items = await prisma.planItem.count({
      where: { lessonId: { not: null }, plan: { goalId } },
    });

    expect({ events: getStreamedEvents(), items }).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ status: "completed", step: "writeExplanation" }),
      ]),
      items: 1,
    });
  }, SIDE_BY_SIDE);
}

function mockGenerality(isGeneral: boolean) {
  vi.mocked(classifyQuestionGenerality).mockResolvedValue({
    isGeneral,
    probability: isGeneral ? 0.9 : 0.1,
  } as never);
}

describe(explainQuestionWorkflow, () => {
  // Shared courses live in the AI organization, which a fresh test database doesn't have.
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
  });

  it("answers a general question as a shared explanation and outlines its Overview course", async () => {
    const question = `what does it mean when the market is up 2%? ${crypto.randomUUID()}`;
    const courseTitle = `How the stock market works ${crypto.randomUUID().slice(0, 8)}`;
    const { goal } = await explainGoal(question);

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(explanation(courseTitle), "openai/gpt-6-luna"),
    );

    const result = await explainQuestionWorkflow({ goalId: goal.id });

    expect(result.status).toBe("ready");

    const [stored, lesson] = await Promise.all([
      prisma.goal.findUniqueOrThrow({
        include: { plan: { include: { items: true } }, primaryCourse: true },
        where: { id: goal.id },
      }),
      prisma.lesson.findUniqueOrThrow({
        include: { skills: { include: { skill: true } } },
        where: { id: result.lessonId ?? "" },
      }),
    ]);

    expect(lesson).toMatchObject({
      contentStatus: "completed",
      level: "overview",
      visibility: "public",
    });

    expect(lesson.skills[0]?.skill.name).toBe(question);
    expect(stored.plan?.items).toMatchObject([{ kind: "lesson", lessonId: lesson.id }]);
    expect(stored.primaryCourse).toMatchObject({ title: courseTitle, visibility: "public" });

    expect(stored.details).toMatchObject({
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    });

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({
        bands: [{ level: "overview", skills: [] }],
        courseId: stored.primaryCourseId,
      }),
    ]);

    const events = getStreamedEvents().map(
      (event) => `${String(event.step)}:${String(event.status)}`,
    );

    // After the question is read, the search and the writing run side by side. Writing completes
    // once the explanation can be read; the run is ready once its course to go further is linked.
    expect(events.slice(0, 2)).toStrictEqual([
      "classifyQuestion:started",
      "classifyQuestion:completed",
    ]);

    expect(events.slice(2, -2).toSorted()).toStrictEqual([
      "findExplanation:completed",
      "findExplanation:started",
      "writeExplanation:started",
    ]);

    expect(events.slice(-2)).toStrictEqual([
      "writeExplanation:completed",
      "explanationReady:completed",
    ]);
  });

  it("writes the explanation while it looks for the same question asked before", async () => {
    const { goal } = await explainGoal(`why do cats purr? ${crypto.randomUUID()}`);
    const writing = Promise.withResolvers<null>();

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockImplementation(async () => {
      writing.resolve(null);

      return taskResult(
        explanation(`Cats ${crypto.randomUUID().slice(0, 8)}`),
        "openai/gpt-6-luna",
      );
    });

    // The question's identity search only finishes once the writing has begun: waiting for the
    // search before writing would never get there.
    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) => {
      await (subjects.some((subject) => subject.kind === "skill") ? writing.promise : null);

      return taskResult({
        subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
      }) as never;
    });

    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("lets the learner read the explanation before its course to go further is found", async () => {
    const { goal } = await explainGoal(`why is the sea salty? ${crypto.randomUUID()}`);
    const courseTitle = `Oceanography ${crypto.randomUUID().slice(0, 8)}`;

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(explanation(courseTitle), "openai/gpt-6-luna"),
    );

    // The course is only found once the learner can read the explanation: finding the course
    // first would never get there.
    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) => {
      await (subjects.some((subject) => subject.kind === "course")
        ? waitUntilReadable(goal.id)
        : null);

      return taskResult({
        subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
      }) as never;
    });

    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(
      prisma.goal.findUniqueOrThrow({ include: { primaryCourse: true }, where: { id: goal.id } }),
    ).resolves.toMatchObject({ primaryCourse: { title: courseTitle } });
  });

  it("answers the same question at once for the next learner, with the same way to go further", async () => {
    const question = `why does the moon change shape? ${crypto.randomUUID()}`;
    const courseTitle = `The Moon ${crypto.randomUUID().slice(0, 8)}`;
    const [first, second] = await Promise.all([explainGoal(question), explainGoal(question)]);

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(explanation(courseTitle), "openai/gpt-6-luna"),
    );

    const written = await explainQuestionWorkflow({ goalId: first.goal.id });
    vi.mocked(generateQuickExplanation).mockClear();

    await expect(explainQuestionWorkflow({ goalId: second.goal.id })).resolves.toStrictEqual({
      goalId: second.goal.id,
      lessonId: written.lessonId,
      status: "reused",
    });

    // Written while the search looked, and discarded once it found the first one.
    expect(generateQuickExplanation).toHaveBeenCalledOnce();

    await expect(
      prisma.lesson.count({ where: { skills: { some: { skill: { name: question } } } } }),
    ).resolves.toBe(1);

    await expect(
      prisma.goal.findUniqueOrThrow({
        include: { primaryCourse: true },
        where: { id: second.goal.id },
      }),
    ).resolves.toMatchObject({
      details: { relatedQuestions: ["What is an index fund?", "Why do stocks fall?"] },
      primaryCourse: { title: courseTitle },
    });
  });

  it("answers with the explanation already written even when the new writing fails", async () => {
    const question = `why do leaves fall? ${crypto.randomUUID()}`;
    const [first, second] = await Promise.all([explainGoal(question), explainGoal(question)]);

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValueOnce(
      taskResult(explanation(`Trees ${crypto.randomUUID().slice(0, 8)}`), "openai/gpt-6-luna"),
    );

    const written = await explainQuestionWorkflow({ goalId: first.goal.id });

    // The discarded write fails before the search is done: the run still answers.
    vi.mocked(generateQuickExplanation).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(explainQuestionWorkflow({ goalId: second.goal.id })).resolves.toStrictEqual({
      goalId: second.goal.id,
      lessonId: written.lessonId,
      status: "reused",
    });
  });

  it("keeps a personal question's explanation private to the learner", async () => {
    const { goal, user } = await explainGoal(
      `should I sell my own shares this week? ${crypto.randomUUID()}`,
    );

    mockGenerality(false);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(explanation(`Investing ${crypto.randomUUID().slice(0, 8)}`), "openai/gpt-6-luna"),
    );

    const result = await explainQuestionWorkflow({ goalId: goal.id });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: result.lessonId ?? "" } }),
    ).resolves.toMatchObject({ ownerId: user.id, visibility: "private" });

    // Only its shared course to go further is looked up across the Library, never the question.
    expect(generateSearchTerms).not.toHaveBeenCalledWith(
      expect.objectContaining({ subjects: [expect.objectContaining({ kind: "skill" })] }),
    );

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      expect.objectContaining({
        analytics: expect.objectContaining({ contentScope: "personal" }),
        lessonId: result.lessonId,
      }),
    ]);
  });

  it("draws the pictures a new explanation asks for, and none again when it's reused", async () => {
    const question = `why is the sky blue? ${crypto.randomUUID()}`;
    const [first, second] = await Promise.all([explainGoal(question), explainGoal(question)]);
    const written = explanation(`Light ${crypto.randomUUID().slice(0, 8)}`);

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(
        {
          ...written,
          screens: written.screens.map((screen) => ({ ...screen, imagePrompt: "A prism" })),
        },
        "openai/gpt-6-luna",
      ),
    );

    const result = await explainQuestionWorkflow({ goalId: first.goal.id });

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      {
        analytics: { contentScope: "shared", distinctId: first.user.id, goalId: first.goal.id },
        lessonId: result.lessonId,
      },
    ]);

    vi.mocked(start).mockClear();

    await expect(explainQuestionWorkflow({ goalId: second.goal.id })).resolves.toMatchObject({
      status: "reused",
    });

    expect(start).not.toHaveBeenCalledWith(lessonImagesWorkflow, expect.anything());
  });

  it("answers a guest without pictures or a new course to go further", async () => {
    const question = `why do leaves change color? ${crypto.randomUUID()}`;
    const { goal, user } = await explainGoal(question);
    const written = explanation(`Leaves ${crypto.randomUUID().slice(0, 8)}`);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(
        {
          ...written,
          screens: written.screens.map((screen) => ({ ...screen, imagePrompt: "A maple leaf" })),
        },
        "openai/gpt-6-luna",
      ),
    );

    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(start).not.toHaveBeenCalledWith(lessonImagesWorkflow, expect.anything());
    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: null,
    });
  });

  it("writes once more when an explanation fails its checks, then gives up without saving and counts the failure", async () => {
    const { goal } = await explainGoal(`how do tides work? ${crypto.randomUUID()}`);
    const broken = explanation("Oceans");

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult({ ...broken, screens: broken.screens.slice(0, 2) }, "openai/gpt-6-luna"),
    );

    await expect(
      explainQuestionWorkflow({ goalId: goal.id, platform: "android" }),
    ).resolves.toMatchObject({ lessonId: null, status: "failed" });

    expect(generateQuickExplanation).toHaveBeenCalledTimes(2);

    await expect(prisma.planItem.count({ where: { plan: { goalId: goal.id } } })).resolves.toBe(0);

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: goal.userId,
        name: "Generation Failed",
        properties: { content_kind: "explanation", model: null, task: "explain-question" },
        shared: expect.objectContaining({ platform: "android" }),
      }),
    );
  });

  it("answers at once, without a model, when the question was already answered", async () => {
    const { goal } = await explainGoal(`what is inflation? ${crypto.randomUUID()}`);

    mockGenerality(true);

    vi.mocked(generateQuickExplanation).mockResolvedValue(
      taskResult(explanation(`Money ${crypto.randomUUID().slice(0, 8)}`), "openai/gpt-6-luna"),
    );

    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    vi.clearAllMocks();

    // Started again, such as by a client asking for the goal's generation once more.
    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      lessonId: null,
      status: "ready",
    });

    expect(classifyQuestionGenerality).not.toHaveBeenCalled();
    expect(generateQuickExplanation).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([{ status: "completed", step: "explanationReady" }]);
  });

  it("leaves a question another run is answering to that run", async () => {
    const { goal } = await explainGoal(`why do prices rise? ${crypto.randomUUID()}`);

    // The run answering it saved itself on the goal when it started.
    await prisma.goal.update({ data: { generationRunId: "owner-run" }, where: { id: goal.id } });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "owner-run" });

    await expect(explainQuestionWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      lessonId: null,
      status: "joined",
    });

    expect(classifyQuestionGenerality).not.toHaveBeenCalled();

    // A client following this run's id is pointed at the run doing the work.
    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "owner-run", status: "started", step: "joinRunningExplanation" },
    ]);

    // The goal keeps pointing at the run doing the work, which its waiting screen follows.
    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      generationRunId: "owner-run",
    });
  });

  it("reports a question whose goal no longer exists", async () => {
    const goalId = crypto.randomUUID();

    await expect(explainQuestionWorkflow({ goalId })).resolves.toStrictEqual({
      goalId,
      lessonId: null,
      status: "missing",
    });

    expect(getStreamedEvents()).toStrictEqual([
      {
        entityId: goalId,
        reason: "contentValidationFailed",
        status: "error",
        step: "workflowError",
      },
    ]);
  });
});
