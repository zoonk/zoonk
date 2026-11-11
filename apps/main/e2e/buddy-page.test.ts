import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { type TutorToolOffer } from "@zoonk/core/lesson-questions/tool-offer-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { prisma } from "@zoonk/db";
import { holdScripts } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { fulfillTutorAnswer, proposeFutureRestDay, toProposal } from "./tutor-answer";

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

const SAVED = "Saved. You can change it in your plan.";

type BuddyAnswer = { answer: string; planChange?: PlanChangeView; toolOffer?: TutorToolOffer };

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

    const parts = [
      next.planChange && { data: next.planChange, type: "data-plan-change" as const },
      next.toolOffer && { data: next.toolOffer, type: "data-tool-offer" as const },
    ].filter((part) => part !== undefined);

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

  test("Not now pressed before the page hydrates declines the change once it does", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const { change, name: day } = await proposeFutureRestDay(plan.id);

      await prisma.lessonQuestion.create({
        data: {
          answer: `Tap Apply to free your ${day}s.`,
          contextKind: "plan",
          contextSnapshot: {},
          goal: { connect: { id: user.goalId } },
          planChange: { connect: { id: change.id } },
          question: `No studying on ${day}s`,
          requestFingerprint: randomUUID(),
          requestId: randomUUID(),
          status: "completed",
          thread: { create: { goalId: user.goalId, kind: "plan", userId: user.id } },
        },
      });

      const release = await holdScripts(page);
      await page.goto("/buddy", { waitUntil: "domcontentloaded" });

      const card = page.getByRole("region", { name: "Change to your plan" });
      await card.getByRole("button", { name: "Not now" }).click();
      await release();

      await expect(card.getByRole("status")).toHaveText("Not applied. Your plan stays as it was.");
      await expect.poll(() => readChangeStatus(change.id)).toBe("declined");
    });
  });

  test("the buddy offers the country a learner asked for, which saves only on their tap and gives way to the next one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const readCountry = async () => {
        const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
        return goal.targetRegion;
      };

      const englishOffer = (region: string): TutorToolOffer => ({
        goalId: user.goalId,
        kind: "variety",
        languageFlag: region.toLowerCase(),
        targetLanguage: "en",
        targetRegion: region,
        taughtRegion: "US",
      });

      await stubBuddy({
        answers: [
          {
            answer: "Your lessons stay the same. Tap Apply and I'll use Canadian English.",
            toolOffer: englishOffer("CA"),
          },
          {
            answer: "Your lessons stay the same. Tap Apply and I'll use Australian English.",
            toolOffer: englishOffer("AU"),
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: /^Conversation with /u });
      const composer = conversation.getByRole("textbox", { name: /^Message /u });

      const ask = async (question: string) => {
        await composer.fill(question);
        await expect(conversation.getByRole("button", { name: "Send" })).toBeEnabled();
        await composer.press("Enter");
      };

      await ask("Can I practice Canadian English?");

      const canada = conversation.getByRole("region", { name: "English (Canada)" });
      const status = canada.getByRole("status");
      await expect(canada.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(status).toBeEmpty();
      expect(await readCountry()).toBeNull();

      await canada.getByRole("button", { name: "Apply" }).click();
      await expect(status).toHaveText(SAVED);
      await expect(canada).toBeFocused();
      await expect(canada.getByRole("button", { name: "Apply" })).toBeHidden();
      await expect.poll(readCountry).toBe("CA");

      await ask("Actually, Australian English?");

      const australia = conversation.getByRole("region", { name: "English (Australia)" });
      await australia.getByRole("button", { name: "Apply" }).click();
      await expect(australia.getByRole("status")).toHaveText(SAVED);
      await expect.poll(readCountry).toBe("AU");
      await expect(canada.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(status).toBeEmpty();
    });
  });
});
