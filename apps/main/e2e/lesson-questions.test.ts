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
import { fulfillTutorAnswer } from "./tutor-answer";

const ANSWER_TEXT = "Gravity keeps pulling while the satellite moves forward, bending its path.";

/**
 * A Library lesson played in the lesson player, whose tutor is the questions sheet: a check, then
 * an explanation.
 */
async function createQuestionLesson() {
  // A letter first: an id of digits alone reads as a number, which the lesson writes grouped.
  const uniqueId = `q${randomUUID().slice(0, 8)}`;
  const question = `Why does a satellite stay in orbit ${uniqueId}?`;
  const correctOption = `Gravity bends its path ${uniqueId}`;
  const secondStepTitle = `A second perspective ${uniqueId}`;

  const { lesson, steps } = await playableLessonFixture({
    lesson: { language: "en", title: `Staying in orbit ${uniqueId}` },
    steps: [
      {
        content: {
          basis: null,
          options: [
            { id: `right-${uniqueId}`, isCorrect: true, reason: "Right.", text: correctOption },
            {
              id: `wrong-${uniqueId}`,
              isCorrect: false,
              reason: `Gravity is still there ${uniqueId}`,
              text: `There is no gravity ${uniqueId}`,
            },
          ],
          question,
        },
        kind: "check",
      },
      {
        content: { text: `An orbit is continuous free fall ${uniqueId}.`, title: secondStepTitle },
        kind: "explanation",
      },
    ],
  });

  return {
    correctOption,
    lessonId: lesson.id,
    question,
    secondStepTitle,
    stepIds: steps.map((step) => step.id),
    url: `/learn/${lesson.id}`,
  };
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

/**
 * The tutor's API routes, answered like the API: each screen's thread, new questions and their
 * streamed answers. The player's browser tests cover how the tutor handles failures and late or
 * unfinished answers; this checks the app's wiring to the routes.
 */
async function mockQuestionApi({ lessonId, page }: { lessonId: string; page: Page }) {
  const threadId = randomUUID();

  const state: {
    answerRequests: number;
    getRequests: number;
    inputs: CreateLessonQuestionInput[];
    questions: LessonQuestionResource[];
  } = { answerRequests: 0, getRequests: 0, inputs: [], questions: [] };

  await page.route("**/v1/lessons/**/questions*", async (route) => {
    expectBearerAuthorization(route);

    if (route.request().method() === "GET") {
      state.getRequests += 1;
      const stepId = new URL(route.request().url()).searchParams.get("stepId");

      const questions = state.questions.filter(
        (question) =>
          !stepId || ("stepId" in question.context && question.context.stepId === stepId),
      );

      const responseJson =
        state.questions.length === 0
          ? null
          : { hasMore: false, id: threadId, lessonId, nextCursor: null, questions };

      await route.fulfill({ contentType: "application/json", json: responseJson, status: 200 });
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
      planChange: null,
      question: input.question,
      status: "pending",
      toolOffer: null,
      updatedAt: now,
    };

    state.questions = [...state.questions, question];
    await route.fulfill({ contentType: "application/json", json: question, status: 201 });
  });

  await page.route("**/v1/questions/*", async (route) => {
    expectBearerAuthorization(route);
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
  test("asks from the screen in view and follows up on the next one in its own thread", async ({
    userWithoutProgress: page,
  }) => {
    // Any signed-in learner can ask, without a subscription or progress.
    const scenario = await createQuestionLesson();
    const api = await mockQuestionApi({ lessonId: scenario.lessonId, page });

    await page.goto(scenario.url);
    await expect(page.getByText(scenario.question)).toBeVisible();

    // The screen's history preloads once the page is interactive. On a wide screen the buddy is
    // beside the lesson, about the screen in view.
    await expect.poll(() => api.getRequests).toBe(1);
    const aside = page.getByRole("complementary", { name: "Help with this screen" });
    const textbox = aside.getByRole("textbox", { name: "Ask Zu about this screen" });

    const firstQuestion = `Can you explain this orbit ${randomUUID().slice(0, 6)}?`;
    await textbox.fill(firstQuestion);
    await textbox.press("Enter");

    // One question asks for one answer.
    const conversation = page.getByRole("region", { name: "Questions to Zu" });
    await expect(conversation.getByText(ANSWER_TEXT)).toBeVisible();
    expect(api.answerRequests).toBe(1);

    expect(api.inputs[0]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[0], stepNumber: 1 },
      question: firstQuestion,
    });

    await conversation.getByRole("button", { name: "From the lesson" }).click();
    await page.getByRole("radio", { name: scenario.correctOption }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect(page.getByText(scenario.secondStepTitle)).toBeVisible();

    // The next screen's questions are its own thread.
    const followUp = "How does that connect to free fall?";
    await aside.getByRole("textbox", { name: "Ask Zu about this screen" }).fill(followUp);
    await aside.getByRole("button", { name: "Send" }).click();
    await expect(conversation.getByText(followUp)).toBeVisible();
    await expect(conversation.getByText(firstQuestion)).not.toBeVisible();
    await expect.poll(() => api.inputs.length).toBe(2);

    expect(api.inputs[1]).toMatchObject({
      context: { kind: "step", stepId: scenario.stepIds[1], stepNumber: 2 },
      question: followUp,
    });
  });
});
