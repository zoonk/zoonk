import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { expect } from "./fixtures";
import { fulfillTutorAnswer } from "./tutor-answer";

/**
 * "Ask" beyond lessons: the chapter page and a finished mock. The tutor's API is stubbed in the
 * browser, like the lesson tutor's tests, so the answer is fixed; the API's own tests cover what it
 * stores and streams.
 */

const SCREEN_TUTOR_ANSWER = "Here's the short version, from what the screen shows.";

/** Screens ask about their chapter or mock as a whole. */
function toContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionResource["context"] {
  if (context.kind === "step" || context.kind === "answer") {
    throw new Error("A screen asks about the whole thing, never one step");
  }

  return { kind: context.kind };
}

/** Stands in for the tutor's thread, question and answer routes of every screen. */
export async function stubScreenTutor(page: Page) {
  const asked: { input: CreateLessonQuestionInput; path: string }[] = [];

  await page.route(/\/v1\/(?:chapters|mocks)\/[^/]+\/questions/u, async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({ body: "null", contentType: "application/json" });
      return;
    }

    const input = createLessonQuestionInputSchema.parse(request.postDataJSON());
    const now = new Date().toISOString();
    asked.push({ input, path: new URL(request.url()).pathname });

    const question: LessonQuestionResource = {
      answer: null,
      context: toContextSummary(input.context),
      createdAt: now,
      id: randomUUID(),
      planChange: null,
      question: input.question,
      status: "pending",
      toolOffer: null,
      updatedAt: now,
    };

    await route.fulfill({ json: question, status: 201 });
  });

  await page.route("**/v1/questions/*/answers", (route) =>
    fulfillTutorAnswer(route, SCREEN_TUTOR_ANSWER),
  );

  return asked;
}

/**
 * Opens "Ask", where the learner's buddy answers (a neutral "Buddy" for learners who haven't
 * picked one), and sends a suggested question in one tap.
 */
export async function askSuggestion({
  ask,
  description,
  page,
  suggestion,
  tutorName = "Buddy",
}: {
  ask: string;
  description: string;
  page: Page;
  suggestion: string;
  tutorName?: string;
}) {
  // Screens offer "Ask" as a button or, like the plan, as an item of their open "…" menu.
  await page
    .getByRole("button", { name: ask })
    .or(page.getByRole("menuitem", { name: ask }))
    .click();

  const dialog = page.getByRole("dialog", { name: tutorName });
  await expect(dialog.getByText(description)).toBeVisible();

  await dialog.getByRole("button", { name: suggestion }).click();
  await expect(dialog.getByText(SCREEN_TUTOR_ANSWER)).toBeVisible();

  return dialog;
}
