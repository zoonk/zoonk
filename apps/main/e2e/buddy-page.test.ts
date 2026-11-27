import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { type TutorToolOffer } from "@zoonk/core/lesson-questions/tool-offer-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { prisma } from "@zoonk/db";
import { expectHydrated, holdScripts } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { fulfillTutorAnswer, proposeFutureRestDay, toProposal } from "./tutor-answer";

const REPRICED = "Your plan changed since you saw this. Here's what it does now.";

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

const SAVED = "Saved. You can change it in your plan.";

type BuddyAnswer = { answer: string; planChange?: PlanChangeView; toolOffer?: TutorToolOffer };

/**
 * E2E has no model, so the answer is the one part stubbed: it saves what the model's run would have
 * and streams it. The question itself goes to the real API, which creates its conversation.
 */
async function stubBuddy({ answers, page }: { answers: BuddyAnswer[]; page: Page }) {
  const asked: { question: string }[] = [];
  const queue = [...answers];

  await page.route("**/v1/questions/*/answers", async (route) => {
    const questionId = new URL(route.request().url()).pathname.split("/").at(-2);
    const next = queue.shift() ?? { answer: "Okay." };

    const saved = await prisma.lessonQuestion.update({
      data: {
        answer: next.answer,
        planChangeId: next.planChange?.id,
        status: "completed",
        toolOffer: next.toolOffer,
      },
      where: { id: questionId },
    });

    asked.push({ question: saved.question });

    const parts = [
      next.planChange && { data: next.planChange, type: "data-plan-change" as const },
      next.toolOffer && { data: next.toolOffer, type: "data-tool-offer" as const },
    ].filter((part) => part !== undefined);

    await fulfillTutorAnswer(route, next.answer, parts);
  });

  return asked;
}

const MS_PER_HOUR = 3_600_000;

/** A conversation as an earlier visit left it: one question, answered. */
function conversationFixture({
  askedAt = new Date(),
  goalId,
  question,
  userId,
}: {
  askedAt?: Date;
  goalId: string;
  question: string;
  userId: string;
}) {
  return prisma.lessonQuestionThread.create({
    data: {
      createdAt: askedAt,
      goalId,
      kind: "plan",
      questions: {
        create: {
          answer: `Answer to: ${question}`,
          contextKind: "plan",
          contextSnapshot: {},
          createdAt: askedAt,
          goalId,
          question,
          requestFingerprint: randomUUID(),
          requestId: randomUUID(),
          status: "completed",
        },
      },
      updatedAt: askedAt,
      userId,
    },
  });
}

test.describe("Buddy tab", () => {
  test("a new day opens blank, and a first question makes a conversation of its own that the list opens beside the earlier one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const earlier = await conversationFixture({
        askedAt: new Date(Date.now() - 2 * 24 * MS_PER_HOUR),
        goalId: user.goalId,
        question: "What is superposition?",
        userId: user.id,
      });

      await stubBuddy({ answers: [{ answer: "Light spreads like a wave." }], page });
      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      const list = page.getByRole("complementary", { name: "Conversations" });

      await expectHydrated(composer);
      await expect(list.getByRole("link", { name: /^What is superposition\?/u })).toBeVisible();
      await expect(conversation.getByText("What is superposition?")).toBeHidden();

      await expect(list.getByRole("link", { name: "New conversation" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await composer.fill("Why is light a wave?");
      await composer.press("Enter");
      await expect(conversation.getByText("Light spreads like a wave.")).toBeVisible();

      // The address names the conversation without loading the page again: the composer keeps focus.
      await expect(page).toHaveURL(/\/buddy\/[0-9a-f-]{36}$/u);
      await expect(composer).toBeFocused();
      const created = new URL(page.url()).pathname.split("/").at(-1);

      await expect(list.getByRole("link", { name: /^Why is light a wave\?/u })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expect
        .poll(() =>
          prisma.lessonQuestionThread.count({
            where: { goalId: user.goalId, id: created, kind: "plan", userId: user.id },
          }),
        )
        .toBe(1);

      await list.getByRole("link", { name: /^What is superposition\?/u }).click();
      await expect(page).toHaveURL(new RegExp(`/buddy/${earlier.id}$`, "u"));
      await expect(conversation.getByText("Answer to: What is superposition?")).toBeVisible();
      await expect(conversation.getByText("Why is light a wave?")).toBeHidden();

      await list.getByRole("link", { name: "New conversation" }).click();
      await expect(page).toHaveURL(/\/buddy\/new$/u);
      await expect(conversation.getByText("Answer to: What is superposition?")).toBeHidden();
      await expect(conversation.getByRole("article")).toHaveCount(0);
      await expect(composer).toHaveValue("");

      // A visit later the same day comes back to today's conversation.
      await page.goto("/buddy");
      await expect(conversation.getByText("Light spreads like a wave.")).toBeVisible();
      await expect(conversation.getByText("What is superposition?")).toBeHidden();
    });
  });

  test("a question that saves after the learner left for Today leaves the next new conversation blank", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      await stubBuddy({
        answers: [{ answer: "Light spreads like a wave." }, { answer: "Through measurement." }],
        page,
      });

      const { promise: held, resolve: release } = Promise.withResolvers<null>();
      const { promise: sent, resolve: arrived } = Promise.withResolvers<null>();
      let holdNext = true;

      await page.route("**/v1/goals/*/buddy/conversations/*/questions", async (route) => {
        if (route.request().method() === "POST" && holdNext) {
          holdNext = false;
          arrived(null);
          await held;
        }

        await route.continue();
      });

      const countConversations = () =>
        prisma.lessonQuestionThread.count({
          where: { goalId: user.goalId, kind: "plan", userId: user.id },
        });

      await page.goto("/buddy/new");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      const tabs = page.getByRole("navigation", { name: "Learning tabs" });

      await expectHydrated(composer);
      await composer.fill("Why is light a wave?");
      await composer.press("Enter");
      await sent;

      await tabs.getByRole("link", { exact: true, name: "Today" }).click();
      await expect(page).toHaveURL(/\/today$/u);
      release(null);
      await expect.poll(countConversations).toBe(1);

      await tabs.getByRole("link", { name: /Otto/u }).click();
      await expect(page).toHaveURL(/\/buddy$/u);
      await expect(conversation.getByText("Light spreads like a wave.")).toBeVisible();

      await page
        .getByRole("complementary", { name: "Conversations" })
        .getByRole("link", { name: "New conversation" })
        .click();

      await expect(page).toHaveURL(/\/buddy\/new$/u);
      await expect(conversation.getByText("Why is light a wave?")).toBeHidden();
      await expect(conversation.getByRole("article")).toHaveCount(0);

      await composer.fill("How do you read one?");
      await composer.press("Enter");
      await expect(conversation.getByText("Through measurement.")).toBeVisible();
      await expect.poll(countConversations).toBe(2);
    });
  });

  test("a follow-up in a conversation older than the list's first page keeps its first question as its title", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const oldest = await conversationFixture({
        askedAt: new Date(Date.now() - 40 * 24 * MS_PER_HOUR),
        goalId: user.goalId,
        question: "What is a qubit?",
        userId: user.id,
      });

      await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          conversationFixture({
            askedAt: new Date(Date.now() - (index + 1) * 24 * MS_PER_HOUR),
            goalId: user.goalId,
            question: `Question from day ${index + 1}`,
            userId: user.id,
          }),
        ),
      );

      await stubBuddy({ answers: [{ answer: "Through measurement." }], page });
      await page.goto(`/buddy/${oldest.id}`);

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      const list = page.getByRole("complementary", { name: "Conversations" });

      await expectHydrated(composer);
      await expect(list.getByRole("link", { name: /^What is a qubit\?/u })).toBeHidden();

      await composer.fill("How do you read one?");
      await composer.press("Enter");
      await expect(conversation.getByText("Through measurement.")).toBeVisible();

      await expect(list.getByRole("link", { name: /^What is a qubit\?/u })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expect(list.getByRole("link", { name: /^How do you read one\?/u })).toBeHidden();
    });
  });

  test("a question from search waits in a new conversation's composer, and a conversation of another learner or another goal doesn't open", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const stranger = await userFixture();
      const strangerGoal = await goalFixture({ userId: stranger.id });

      const otherGoal = await goalFixture({ userId: user.id });

      const [, elsewhere, theirs] = await Promise.all([
        conversationFixture({
          goalId: user.goalId,
          question: "What should I review today?",
          userId: user.id,
        }),
        conversationFixture({
          goalId: otherGoal.id,
          question: "A question about my other goal",
          userId: user.id,
        }),
        conversationFixture({
          goalId: strangerGoal.id,
          question: "A stranger's own question",
          userId: stranger.id,
        }),
      ]);

      const countAsked = () =>
        prisma.lessonQuestion.count({ where: { thread: { userId: user.id } } });

      const asked = await countAsked();

      await page.goto("/buddy/new?ask=Why%20is%20the%20sky%20blue%3F");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });

      await expect(composer).toHaveValue("Why is the sky blue?");
      await expect(conversation.getByRole("article")).toHaveCount(0);
      expect(await countAsked()).toBe(asked);

      // Their own conversation of a goal they aren't on gives way to this goal's own.
      await page.goto(`/buddy/${elsewhere.id}`);
      await expect(page).toHaveURL(/\/buddy$/u);
      await expect(conversation.getByText("Answer to: What should I review today?")).toBeVisible();
      await expect(page.getByText("A question about my other goal")).toBeHidden();

      await page.goto(`/buddy/${theirs.id}`);
      await expect(page.getByText("We couldn't find this page")).toBeVisible();
      await expect(page.getByText("A stranger's own question")).toBeHidden();
    });
  });

  test("enables saving only after the buddy name changes", async ({ browser }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      await prisma.userLearningProfile.update({
        data: { buddyKind: "zu", buddyName: null },
        where: { userId: user.id },
      });

      await page.goto("/buddy");
      const menu = page.getByRole("button", { name: "More about Zu" });
      await menu.click();
      await page.getByRole("menuitem", { name: "Change Zu" }).click();

      const dialog = page.getByRole("dialog", { name: "Your buddy" });
      const field = dialog.getByRole("textbox", { name: "Name" });
      const save = dialog.getByRole("button", { name: "Save" });
      await expect(save).toBeDisabled();
      await expect(field).toHaveValue("Zu");

      await field.fill("Nova");
      await expect(save).toBeEnabled();
      await field.fill("Zu");
      await expect(save).toBeDisabled();
    });
  });

  test("the buddy proposes a plan change that applies only on the learner's tap, and Undo takes it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const { change, name: day, weekday } = await proposeFutureRestDay(plan.id);

      const asked = await stubBuddy({
        answers: [
          {
            answer: `Done: I prepared it. Tap Change my plan to free your ${day}s.`,
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

      // The card's title is the question while proposed and the statement once applied.
      const card = conversation.getByRole("region", { name: new RegExp(day, "u") });
      await expect(card).toHaveAccessibleName(`Rest every ${day}?`);
      await expect(card.getByRole("button", { name: "Change my plan" })).toBeVisible();
      expect(asked).toStrictEqual([{ question: `No studying on ${day}s` }]);
      expect(await readChangeStatus(change.id)).toBe("proposed");

      // The fixture saves the change without its numbers, as one from an earlier day: the first
      // tap works them out from today's plan and asks again; the second applies it.
      await card.getByRole("button", { name: "Change my plan" }).click();
      await expect(card.getByText(REPRICED)).toBeVisible();
      await expect(card).toHaveAccessibleName(`Rest every ${day}?`);
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await card.getByRole("button", { name: "Change my plan" }).click();
      await expect(card).toHaveAccessibleName(`${day}: rest day.`);
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
          return (settings.settings as { weekdayMinutes?: number[] }).weekdayMinutes?.[weekday];
        })
        .toBe(0);

      await card.getByRole("button", { name: "Undo" }).click();
      await expect(card).toHaveAccessibleName(`Rest every ${day}?`);
      await expect(card.getByRole("button", { name: "Change my plan" })).toBeVisible();
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
          answer: `Tap Change my plan to free your ${day}s.`,
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

      const card = page.getByRole("region", { name: `Rest every ${day}?` });
      await card.getByRole("button", { name: "Not now" }).click();
      await release();

      await expect(card.getByRole("status")).toHaveText("Your plan stays as it was.");
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

  test("the buddy offers another content country, which saves and owes the plan's rebuild only on the learner's tap", async ({
    browser,
  }) => {
    // The persona's goal is in Portuguese, which names its countries; the app speaks English.
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = isJsonObject(goal.details) ? goal.details : {};

      await prisma.goal.update({
        data: { contentCountry: "PT", details: { ...details, countryDependent: true } },
        where: { id: goal.id },
      });

      const readCountry = async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.contentCountry;
      };

      const readRebuilds = () =>
        prisma.followUp.count({ where: { key: goal.id, kind: "rebuildGoalCurriculum" } });

      await stubBuddy({
        answers: [
          {
            answer: "Tap Change country and I'll make your plan for Germany.",
            toolOffer: {
              country: "DE",
              countryName: "Alemanha",
              goalId: goal.id,
              kind: "contentCountry",
              languageFlag: "de",
              lessonVariety: null,
            },
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: /^Conversation with /u });
      await conversation.getByRole("textbox", { name: /^Message /u }).fill("I moved to Germany.");
      await expect(conversation.getByRole("button", { name: "Send" })).toBeEnabled();
      await conversation.getByRole("textbox", { name: /^Message /u }).press("Enter");

      const germany = conversation.getByRole("region", { name: "Country: Alemanha" });
      const status = germany.getByRole("status");
      await expect(germany.getByRole("button", { name: "Change country" })).toBeVisible();
      await expect(status).toBeEmpty();
      expect(await readCountry()).toBe("PT");
      expect(await readRebuilds()).toBe(0);

      await germany.getByRole("button", { name: "Change country" }).click();

      await expect(status).toHaveText(
        "Saved. Your new plan is getting ready, and you can keep studying.",
      );

      await expect.poll(readCountry).toBe("DE");
      await expect.poll(readRebuilds).toBe(1);
    });
  });
});
