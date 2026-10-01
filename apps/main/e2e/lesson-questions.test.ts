import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@playwright/test";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionContextSummary,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";
import { fulfillTutorAnswer } from "./tutor-answer";

const FORMATTED_ANSWER = [
  "### Key idea",
  "- **Gravity** bends the path.\n- [Velocity](https://example.com) carries it forward.\n  - Tangential motion matters.",
  "1. Measure the speed.\n2. Compare the direction.",
  "> An orbit is continuous free fall.",
  "Use `orbitalSpeed` for the speed.",
  "```javascript\nconst orbitalSpeed = 7.8;\nconsole.log(orbitalSpeed);\n```",
  "| Quantity | Unit |\n| --- | --- |\n| Speed | km/s |",
  String.raw`The mean radius is $$\overline{r}$$ and the speed is:`,
  "$$\nv = \\sqrt{\\frac{GM}{r}}\n$$",
  "```mermaid\nflowchart TD\n  accTitle: How an orbit forms\n  accDescr: Gravity and forward motion produce an orbit.\n  A[Gravity] --> B[Orbit]\n  C[Forward motion] --> B\n```",
].join("\n\n");

const ANSWER_TEXT = "Gravity keeps pulling while the satellite moves forward, bending its path.";

function questionResource({
  answer = null,
  context,
  question,
  status,
}: {
  answer?: string | null;
  context: LessonQuestionContextSummary;
  question: string;
  status: LessonQuestionResource["status"];
}): LessonQuestionResource {
  const now = new Date().toISOString();

  return { answer, context, createdAt: now, id: randomUUID(), question, status, updatedAt: now };
}

type QuestionLessonScenario = {
  correctOption: string;
  lessonId: string;
  question: string;
  stepIds: string[];
  stepTitles: string[];
  url: string;
  wrongOption: string;
};

/**
 * A Library lesson played in the lesson player, whose tutor is the questions sheet: a check (or,
 * with `staticOnly`, an explanation) first, then optionally an explanation.
 */
async function createQuestionLesson({
  includeSecondStep = false,
  staticOnly = false,
}: { includeSecondStep?: boolean; staticOnly?: boolean } = {}): Promise<QuestionLessonScenario> {
  const uniqueId = randomUUID().slice(0, 8);
  const question = `Why does a satellite stay in orbit ${uniqueId}?`;
  const correctOption = `Gravity bends its path ${uniqueId}`;
  const wrongOption = `There is no gravity ${uniqueId}`;
  const stepTitles = [`Orbit concept ${uniqueId}`, `A second perspective ${uniqueId}`];

  const firstStep = staticOnly
    ? { content: { text: question, title: stepTitles[0] }, kind: "explanation" as const }
    : {
        content: {
          options: [
            { id: `right-${uniqueId}`, isCorrect: true, reason: "Right.", text: correctOption },
            {
              id: `wrong-${uniqueId}`,
              isCorrect: false,
              reason: `Gravity is still there ${uniqueId}`,
              text: wrongOption,
            },
          ],
          question,
        },
        kind: "check" as const,
      };

  const secondStep = {
    content: { text: `An orbit is continuous free fall ${uniqueId}.`, title: stepTitles[1] },
    kind: "explanation" as const,
  };

  const { lesson, steps } = await playableLessonFixture({
    lesson: { title: `Staying in orbit ${uniqueId}` },
    steps: includeSecondStep ? [firstStep, secondStep] : [firstStep],
  });

  return {
    correctOption,
    lessonId: lesson.id,
    question,
    stepIds: steps.map((step) => step.id),
    stepTitles: includeSecondStep ? stepTitles : stepTitles.slice(0, 1),
    url: `/learn/${lesson.id}`,
    wrongOption,
  };
}

/** Picks an option on the check and checks it, as the learner would. */
async function checkOption(page: Page, option: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
}

function getContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionContextSummary {
  if (context.kind !== "step" && context.kind !== "answer") {
    return { kind: context.kind };
  }

  return { kind: context.kind, stepId: context.stepId, stepNumber: context.stepNumber };
}

function expectBearerAuthorization(route: Route) {
  expect(route.request().headers().authorization).toMatch(/^Bearer .+/u);
}

function matchesQuestionScope({
  question,
  stepId,
  contextKind,
}: {
  question: LessonQuestionResource;
  stepId: string | null;
  contextKind: string | null;
}) {
  if (stepId && (!("stepId" in question.context) || question.context.stepId !== stepId)) {
    return false;
  }

  return !contextKind || question.context.kind === contextKind;
}

/**
 * The tutor's API routes, answered like the API: each screen's thread, new questions and their
 * streamed answers. The player's browser tests cover how the tutor handles failures and late or
 * unfinished answers; these tests check the app's wiring to the routes.
 */
async function mockQuestionApi({
  initialQuestions = [],
  lessonId,
  page,
}: {
  initialQuestions?: LessonQuestionResource[];
  lessonId: string;
  page: Page;
}) {
  const threadId = randomUUID();

  const state: {
    answerRequests: number;
    completedGetRequests: number;
    getRequests: number;
    inputs: CreateLessonQuestionInput[];
    questions: LessonQuestionResource[];
    statusRequests: number;
  } = {
    answerRequests: 0,
    completedGetRequests: 0,
    getRequests: 0,
    inputs: [],
    questions: initialQuestions,
    statusRequests: 0,
  };

  await page.route("**/v1/lessons/**/questions*", async (route) => {
    expectBearerAuthorization(route);

    if (route.request().method() === "GET") {
      state.getRequests += 1;
      const searchParams = new URL(route.request().url()).searchParams;
      const stepId = searchParams.get("stepId");
      const contextKind = searchParams.get("contextKind");

      const questions = state.questions.filter((question) =>
        matchesQuestionScope({ contextKind, question, stepId }),
      );

      const responseJson =
        state.questions.length === 0
          ? null
          : { hasMore: false, id: threadId, lessonId, nextCursor: null, questions };

      await route.fulfill({ contentType: "application/json", json: responseJson, status: 200 });
      state.completedGetRequests += 1;

      return;
    }

    const input = createLessonQuestionInputSchema.parse(route.request().postDataJSON());
    state.inputs = [...state.inputs, input];
    const now = new Date().toISOString();

    const question: LessonQuestionResource = {
      answer: null,
      context: getContextSummary(input.context),
      createdAt: now,
      id: randomUUID(),
      question: input.question,
      status: "pending",
      updatedAt: now,
    };

    state.questions = [...state.questions, question];
    await route.fulfill({ contentType: "application/json", json: question, status: 201 });
  });

  await page.route("**/v1/questions/*", async (route) => {
    expectBearerAuthorization(route);
    state.statusRequests += 1;
    const questionId = new URL(route.request().url()).pathname.split("/").at(-1);
    const question = state.questions.find((candidate) => candidate.id === questionId);

    await route.fulfill(
      question
        ? { contentType: "application/json", json: question, status: 200 }
        : { contentType: "application/json", json: { error: "Not found" }, status: 404 },
    );
  });

  await page.route("**/v1/questions/**/answers", async (route) => {
    expectBearerAuthorization(route);
    state.answerRequests += 1;
    const questionId = new URL(route.request().url()).pathname.split("/").at(-2);

    state.questions = state.questions.map((question) =>
      question.id === questionId
        ? { ...question, answer: ANSWER_TEXT, status: "completed" }
        : question,
    );

    await fulfillTutorAnswer(route, ANSWER_TEXT);
  });

  return state;
}

test.describe("The tutor", () => {
  test("asks from the screen in view and follows up on the next one in its own thread in Fun", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    // Any signed-in learner can ask, without a subscription or progress.
    await showInMode(page.context(), { mode: "fun", userId: noProgressUser.id });
    const scenario = await createQuestionLesson({ includeSecondStep: true });
    const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

    await page.goto(scenario.url);
    await expectMode(page, "fun");
    await expect(page.getByText(scenario.question)).toBeVisible();
    const lessonUrl = page.url();

    // The screen's history preloads once the page is interactive; the sheet opens with it.
    await expect.poll(() => api.getRequests).toBe(1);
    await page.getByRole("button", { name: "Ask a question" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
    await expect(dialog.getByText("Part 1 of 2")).toBeVisible();

    const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
    await expect(textbox).toHaveAttribute("placeholder", "Ask about the lesson content…");
    const firstQuestion = `Can you explain this orbit ${randomUUID().slice(0, 6)}?`;
    await textbox.fill(firstQuestion);
    await textbox.press("Enter");
    await expect(dialog.getByText(ANSWER_TEXT)).toBeVisible();
    expect(api.getRequests).toBe(1);
    expect(api.answerRequests).toBe(1);
    expect(api.statusRequests).toBe(0);

    expect(api.inputs[0]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[0], stepNumber: 1 },
      question: firstQuestion,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect(page.url()).toBe(lessonUrl);
    await expect(page.getByText(scenario.question)).toBeVisible();
    await expect(page.getByRole("radio", { name: scenario.wrongOption })).not.toBeChecked();

    await checkOption(page, scenario.correctOption);
    await page.getByRole("button", { name: /^Continue/u }).click();
    const secondStepTitle = scenario.stepTitles[1];

    if (!secondStepTitle) {
      throw new Error("Question follow-up scenario is missing its second step");
    }

    await expect(page.getByText(secondStepTitle)).toBeVisible();
    await page.getByRole("button", { name: "Ask a question" }).click();
    await expect(dialog.getByText(firstQuestion)).not.toBeVisible();

    const followUp = "How does that connect to free fall?";
    await dialog.getByRole("textbox", { name: "Ask a question" }).fill(followUp);
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog.getByText(followUp)).toBeVisible();
    await expect.poll(() => api.inputs.length).toBe(2);

    expect(api.inputs[1]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[1], stepNumber: 2 },
      question: followUp,
    });
  });
});

test("renders preloaded Markdown immediately while optional scripts load", async ({
  userWithoutProgress: page,
}) => {
  const scenario = await createQuestionLesson();

  const savedQuestion = questionResource({
    answer: FORMATTED_ANSWER,
    context: { kind: "step", stepId: scenario.stepIds[0] ?? null, stepNumber: 1 },
    question: "Show the orbit with examples",
    status: "completed",
  });

  const api = await mockQuestionApi({
    initialQuestions: [savedQuestion],
    lessonId: scenario.lessonId,
    page,
  });

  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(scenario.url);
  await expect.poll(() => api.completedGetRequests).toBe(1);
  await expect(page.getByRole("button", { name: "Ask a question" })).toBeVisible();
  const releaseScripts = Promise.withResolvers<null>();
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));

  // Diagram rendering and code highlighting must not delay the rest of a saved answer.
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    await releaseScripts.promise;
    await route.continue();
  });

  const dialog = page.getByRole("dialog");

  try {
    await page.getByRole("button", { name: "Ask a question" }).click();
    await expect(dialog.getByRole("heading", { name: "Key idea" })).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveCount(0);
    expect(api.getRequests).toBe(1);
    await expect(dialog.getByRole("listitem")).toHaveCount(5);
    await expect(dialog.getByRole("math")).toHaveCount(2);

    await expect(
      dialog.getByRole("table").getByRole("columnheader", { name: "Quantity" }),
    ).toBeVisible();

    await expect
      .poll(() => dialog.getByRole("code").filter({ hasText: "const orbitalSpeed" }).innerText())
      .toContain(";\nconsole.log");
  } finally {
    releaseScripts.resolve(null);
  }

  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(dialog.getByRole("document", { name: "How an orbit forms" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the mobile visitor flow focused on signing in", async ({ page }) => {
  const scenario = await createQuestionLesson({ staticOnly: true });
  const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(scenario.url);
  await page.getByRole("button", { name: "Ask a question" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Ask questions" })).toBeVisible();
  await expect(dialog.getByText("Sign in to ask questions")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Ask a question" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(api.getRequests).toBe(0);
  expect(api.statusRequests).toBe(0);

  const lessonUrl = page.url();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(page.url()).toBe(lessonUrl);
});
