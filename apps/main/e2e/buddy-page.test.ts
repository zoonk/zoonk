import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { fulfillTutorAnswer, proposeFutureRestDay, toProposal } from "./tutor-answer";

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

type BuddyAnswer = { answer: string; planChange?: PlanChangeView };

async function stubBuddy({ answers, page }: { answers: BuddyAnswer[]; page: Page }) {
  const asked: { question: string }[] = [];
  const queue = [...answers];

  await page.route(/\/v1\/goals\/[^/]+\/plan\/questions/u, async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({ body: "null", contentType: "application/json" });
      return;
    }

    const input = createLessonQuestionInputSchema.parse(request.postDataJSON());
    const now = new Date().toISOString();
    asked.push({ question: input.question });

    const question: LessonQuestionResource = {
      answer: null,
      context: { kind: "plan" },
      createdAt: now,
      id: randomUUID(),
      planChange: null,
      question: input.question,
      status: "pending",
      toolOffer: null,
      updatedAt: now,
    };

    await route.fulfill({ json: { ...question, missionMoment: null }, status: 201 });
  });

  await page.route("**/v1/questions/*/answers", async (route) => {
    const next = queue.shift() ?? { answer: "Okay." };

    const parts = next.planChange
      ? [{ data: next.planChange, type: "data-plan-change" as const }]
      : [];

    await fulfillTutorAnswer(route, next.answer, parts);
  });

  return asked;
}

test.describe("Buddy tab", () => {
  test("the buddy proposes a plan change that applies only on the learner's tap, and Undo takes it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const { change, name: day, weekday } = await proposeFutureRestDay(plan.id);

      const asked = await stubBuddy({
        answers: [
          {
            answer: `Done: I prepared it. Tap Apply to free your ${day}s.`,
            planChange: toProposal(change),
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });

      await composer.fill(`No studying on ${day}s`);
      await expect(conversation.getByRole("button", { name: "Send" })).toBeEnabled();
      await composer.press("Enter");

      const card = conversation.getByRole("region", { name: "Change to your plan" });
      await expect(card).toContainText(`${day}: rest day.`);
      await expect(card.getByRole("button", { name: "Apply" })).toBeVisible();
      expect(asked).toStrictEqual([{ question: `No studying on ${day}s` }]);
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await card.getByRole("button", { name: "Apply" }).click();
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
          return (settings.settings as { weekdayMinutes?: number[] }).weekdayMinutes?.[weekday];
        })
        .toBe(0);

      await card.getByRole("button", { name: "Undo" }).click();
      await expect(card.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect.poll(() => readChangeStatus(change.id)).toBe("proposed");
    });
  });
});
