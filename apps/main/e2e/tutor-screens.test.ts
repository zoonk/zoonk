import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { addTodayMock, playMock } from "./exam-fixtures";
import { expect, test } from "./fixtures";
import { MODES, asPersona, findPlanChapterId } from "./learn-personas";
import { fulfillTutorAnswer } from "./tutor-answer";

/**
 * "Ask" beyond lessons: the chapter page, the Plan tab (the Route in Fun), which also answers about
 * its course, and a finished mock. The tutor's API is stubbed in the browser, like the lesson
 * tutor's tests, so the answer is fixed; the API's own tests cover what it stores and streams.
 */

const CHAPTER = "Exponents and scientific notation";
const ANSWER = "Here's the short version, from what the screen shows.";

/** Screens ask about their chapter, plan or mock as a whole. */
function toContextSummary(
  context: CreateLessonQuestionInput["context"],
): LessonQuestionResource["context"] {
  if (context.kind === "step" || context.kind === "answer") {
    throw new Error("A screen asks about the whole thing, never one step");
  }

  return { kind: context.kind };
}

/** Stands in for the tutor's thread, question and answer routes of every screen. */
async function stubTutorApi(page: Page) {
  const asked: { input: CreateLessonQuestionInput; path: string }[] = [];

  await page.route(
    /\/v1\/(?:chapters|goals|mocks)\/[^/]+(?:\/plan)?\/questions/u,
    async (route) => {
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
        question: input.question,
        status: "pending",
        updatedAt: now,
      };

      await route.fulfill({ json: question, status: 201 });
    },
  );

  await page.route("**/v1/questions/*/answers", (route) => fulfillTutorAnswer(route, ANSWER));

  return asked;
}

/** Opens "Ask", picks a suggested question and sends it as offered. */
async function askSuggestion({
  ask,
  description,
  page,
  suggestion,
}: {
  ask: string;
  description: string;
  page: Page;
  suggestion: string;
}) {
  await page.getByRole("button", { name: ask }).click();

  const dialog = page.getByRole("dialog", { name: "Ask questions" });
  await expect(dialog.getByText(description)).toBeVisible();

  await dialog.getByRole("button", { name: suggestion }).click();
  const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
  await expect(textbox).toHaveValue(suggestion);

  await textbox.press("Enter");
  await expect(dialog.getByText(ANSWER)).toBeVisible();

  return dialog;
}

test.describe("The tutor beyond lessons", () => {
  for (const mode of MODES) {
    test(`asks about a chapter from its page in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        const [chapterId, asked] = await Promise.all([
          findPlanChapterId(user.goalId, CHAPTER),
          stubTutorApi(page),
        ]);

        await page.goto(`/content/chapters/${chapterId}`);
        await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

        const dialog = await askSuggestion({
          ask: "Ask about this chapter",
          description: "Ask questions about this chapter",
          page,
          suggestion: "What will I be able to do after this chapter?",
        });

        expect(asked).toStrictEqual([
          {
            input: expect.objectContaining({
              context: { kind: "chapter" },
              question: "What will I be able to do after this chapter?",
              suggested: true,
            }),
            path: `/v1/chapters/${chapterId}/questions`,
          },
        ]);

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("button", { name: "Ask about this chapter" })).toBeFocused();
      });
    });

    test(`asks why today's plan and about its course from one Ask in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        const asked = await stubTutorApi(page);
        await page.goto("/plan");

        // The plan's tutor also sees the course it's built from, so the plan has one "Ask".
        await expect(page.getByRole("button", { name: /^Ask about/u })).toHaveCount(1);

        const dialog = await askSuggestion({
          ask: "Ask about your plan",
          description: "Ask questions about your plan",
          page,
          suggestion: "Why am I studying this today?",
        });

        await expect(dialog.getByRole("button", { name: "What comes next?" })).toBeHidden();

        const textbox = dialog.getByRole("textbox", { name: "Ask a question" });
        await textbox.fill("How is this course organized, level by level?");
        await dialog.getByRole("button", { name: "Send" }).click();
        await expect(dialog.getByText(ANSWER)).toHaveCount(2);

        expect(asked).toStrictEqual([
          {
            input: expect.objectContaining({ context: { kind: "plan" }, suggested: true }),
            path: `/v1/goals/${user.goalId}/plan/questions`,
          },
          {
            input: expect.objectContaining({
              context: { kind: "plan" },
              question: "How is this course organized, level by level?",
            }),
            path: `/v1/goals/${user.goalId}/plan/questions`,
          },
        ]);

        expect(asked[1]?.input.suggested).toBeUndefined();
      });
    });

    test(`asks about a mock once it's finished in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const [asked, mock] = await Promise.all([
          stubTutorApi(page),
          addTodayMock({ goalId: user.goalId, userId: user.id }),
        ]);

        await page.goto(`/mock/${mock.blockId}`);

        await page
          .getByRole("button", { name: mode === "fun" ? "I'm in" : "Start the mock exam" })
          .click();

        // No help with an exam that's still running.
        await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();
        await expect(page.getByRole("button", { name: "Ask about this mock exam" })).toBeHidden();

        await playMock({ answers: mock.answers, page });
        await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();

        await askSuggestion({
          ask: "Ask about this mock exam",
          description: "Ask questions about this mock exam",
          page,
          suggestion: "What should I practice first?",
        });

        expect(asked).toStrictEqual([
          {
            input: expect.objectContaining({ context: { kind: "mock" }, suggested: true }),
            path: `/v1/mocks/${mock.blockId}/questions`,
          },
        ]);
      });
    });
  }
});
