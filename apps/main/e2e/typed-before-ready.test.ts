import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { type Page, expect, test } from "./fixtures";
import { expectVisibleFocus, tabTo } from "./keyboard-focus";
import {
  expectHydrated,
  followRequests,
  holdCodeWith,
  isHydrated,
  settleIdleWork,
} from "./on-demand-code";

/**
 * A slow device: the page shows its fields (the words a link put in a goal box, an onboarding
 * step) before any of its code arrives, and the learner types into them. Whatever they typed is
 * what the field holds once the code runs, and what the step goes on with.
 */

/** Opens `path` with all of the page's code held back until `release()`. */
async function openBeforeTheCode(page: Page, path: string) {
  const code = await holdCodeWith({ marker: "", page });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect.poll(code.held).toBe(true);
  return code;
}

/**
 * Lets the held code arrive and waits until React has `field`. From then on the page's later loads
 * (its links' prefetches) skip the hold, so none is still being read when the test ends.
 */
async function releaseTheCode({
  code,
  field,
  page,
}: {
  code: Awaited<ReturnType<typeof openBeforeTheCode>>;
  field: Locator;
  page: Page;
}) {
  code.release();
  await expectHydrated(field);
  await page.unrouteAll({ behavior: "ignoreErrors" });
}

/** A month from today on this device, as a date field writes it (well within a plan's reach). */
const DAY_MS = 24 * 60 * 60 * 1000;
const IN_A_MONTH = new Date(Date.now() + 30 * DAY_MS).toLocaleDateString("en-CA");

/** A goal whose onboarding is at the step after the questions in `answered`. */
function goalAt({ details, userId }: { details: Record<string, unknown>; userId: string }) {
  return goalFixture({
    details: { subject: "algebra", ...details },
    generationRunId: null,
    prompt: `learn algebra ${randomUUID()}`,
    title: "Learn algebra",
    userId,
  });
}

test.describe("Typed before the page is ready", () => {
  test("a goal link's words changed before the box is ready stay changed", async ({ page }) => {
    const code = await openBeforeTheCode(page, "/start?goal=learn+to+cook+for+my+family");
    const box = page.getByRole("textbox", { name: "I want to" });
    await expect(box).toHaveValue("learn to cook for my family");

    await box.fill("learn to bake bread for my family");
    await expect(isHydrated(box)).resolves.toBe(false);
    await releaseTheCode({ code, field: box, page });
    await expect(box).toHaveValue("learn to bake bread for my family");
  });

  test("a goal box reached with Tab before it's ready keeps its keyboard ring", async ({
    page,
  }) => {
    const code = await openBeforeTheCode(page, "/start");
    const box = page.getByRole("textbox", { name: "I want to" });

    // The box takes focus on its own once its code runs, on a device with a mouse. A keyboard
    // learner who got there first keeps the ring that says where they are.
    await tabTo(page, box);
    const requests = followRequests(page);
    await releaseTheCode({ code, field: box, page });
    await settleIdleWork(page, requests);

    await expect(box).toBeFocused();
    await expectVisibleFocus(box);
  });

  test("the buddy's goal box keeps words changed before it's ready", async ({
    userWithoutProgress: page,
  }) => {
    const code = await openBeforeTheCode(page, "/buddy?ask=learn+guitar");
    const box = page.getByRole("main").getByRole("textbox", { name: "Your goal" });
    await expect(box).toHaveValue("learn guitar");

    await box.fill("learn guitar for campfire songs");
    await releaseTheCode({ code, field: box, page });
    await expect(box).toHaveValue("learn guitar for campfire songs");
  });

  test("a step's words typed before it's ready are the answer, in each of its fields", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalAt({
      details: { answered: ["purpose"], purpose: "work" },
      userId: noProgressUser.id,
    });

    const code = await openBeforeTheCode(page, `/start/${goal.id}`);
    await expect(page.getByRole("heading", { name: "What do you do at work?" })).toBeVisible();

    const role = page.getByRole("textbox", { name: "Your role" });
    const use = page.getByRole("textbox", { name: "What you'll use it for" });
    await role.fill("Marketing analyst");
    await use.fill("A/B tests");
    await releaseTheCode({ code, field: role, page });
    await expect(role).toHaveValue("Marketing analyst");
    await expect(use).toHaveValue("A/B tests");

    // The step's own state has the words: Continue goes on with them.
    await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
  });

  test("a date picked before the step is ready is the date it goes on with", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalAt({
      details: { answered: ["purpose"], purpose: "deep" },
      userId: noProgressUser.id,
    });

    const code = await openBeforeTheCode(page, `/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    const date = page.getByLabel("Date", { exact: true });
    await date.fill(IN_A_MONTH);
    await releaseTheCode({ code, field: date, page });
    await expect(date).toHaveValue(IN_A_MONTH);
    await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
  });

  test("both follow-up answers typed before the step is ready are the answers it saves", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const questions = ["Which instrument do you play?", "How long have you played it?"];

    const goal = await goalAt({
      details: {
        answered: ["purpose", "targetDate"],
        followUps: questions.map((question) => ({ question })),
        purpose: "deep",
      },
      userId: noProgressUser.id,
    });

    const code = await openBeforeTheCode(page, `/start/${goal.id}`);
    await expect(page.getByRole("heading", { name: "Tell us a bit more" })).toBeVisible();

    const instrument = page.getByRole("textbox", { name: questions[0] });
    const time = page.getByRole("textbox", { name: questions[1] });
    await instrument.fill("Cello");
    await time.fill("Two years");
    await releaseTheCode({ code, field: instrument, page });
    await expect(instrument).toHaveValue("Cello");
    await expect(time).toHaveValue("Two years");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect
      .poll(async () => {
        const { details } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return JSON.stringify(details);
      })
      .toContain('"answer":"Two years"');

    const { details } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(JSON.stringify(details)).toContain('"answer":"Cello"');
  });

  test("a buddy's name typed before the step is ready is the name it saves", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalAt({
      details: { answered: ["purpose", "targetDate", "level", "schedule"], purpose: "deep" },
      userId: noProgressUser.id,
    });

    const code = await openBeforeTheCode(page, `/start/${goal.id}`);
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();

    const name = page.getByRole("textbox", { name: "Name" });
    await name.fill("Pip");
    await releaseTheCode({ code, field: name, page });
    await expect(name).toHaveValue("Pip");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect
      .poll(async () => {
        const profile = await prisma.userLearningProfile.findUnique({
          where: { userId: noProgressUser.id },
        });

        return profile?.buddyName;
      })
      .toBe("Pip");
  });
});
