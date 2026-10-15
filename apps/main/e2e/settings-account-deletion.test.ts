import { readFile } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { expect, test } from "./fixtures";

const FEEDBACK = "The audio skipped on the second screen";

/**
 * What the learner's study left that every learner learns from: a first answer, a finished mock's
 * answer, a finished lesson and an official exam result next to its estimate, and a feedback
 * message with their email.
 */
async function studyLeavingAggregates(user: E2EUser) {
  const userId = user.id;
  const finishedAt = new Date("2026-09-20T15:42:17Z");

  const [skill, lesson, blueprint] = await Promise.all([
    skillFixture(),
    libraryLessonFixture(),
    examBlueprintFixture(),
  ]);

  const [item, mock, feedback] = await Promise.all([
    itemFixture({ skillId: skill.id }),
    prisma.mockExam.create({
      data: {
        conditions: {},
        examBlueprintId: blueprint.id,
        finishedAt,
        sectionStartedAt: finishedAt,
        status: "finished",
        userId,
      },
    }),
    feedbackFixture({ email: user.email, message: FEEDBACK, userId }),
    learningEventFixture({
      contentIds: { lessonId: lesson.id },
      endedAt: finishedAt,
      seconds: 200,
      userId,
    }),
    prisma.examResult.create({
      data: {
        estimateHigh: 700,
        estimateLow: 640,
        examBlueprintId: blueprint.id,
        examName: "ENEM",
        scale: "irt",
        score: 690,
        userId,
      },
    }),
  ]);

  await attemptFixture({
    answeredAt: finishedAt,
    durationMs: 95_000,
    isCorrect: false,
    itemId: item.id,
    mockExamId: mock.id,
    userId,
  });

  return { blueprint, feedback, item, lesson, mock };
}

test.describe("Account data", () => {
  test("downloads the learner's data, then deletes the account and everything in it after a confirmation", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [study] = await Promise.all([
      studyLeavingAggregates(noProgressUser),
      goalFixture({ title: "Pass the driving test", userId: noProgressUser.id }),
      memoryFactFixture({ statement: "Drives a manual car", userId: noProgressUser.id }),
    ]);

    await page.goto("/profile");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my data" }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("zoonk-data.json");
    const exported: unknown = JSON.parse(await readFile((await download.path())!, "utf8"));

    expect(exported).toMatchObject({
      account: { email: noProgressUser.email },
      goals: [expect.objectContaining({ title: "Pass the driving test" })],
      memory: { facts: [expect.objectContaining({ statement: "Drives a manual car" })] },
    });

    await page.getByRole("button", { name: "Delete account" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await expect(dialog.getByText(/can't be undone/u)).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      prisma.user.findUnique({ where: { id: noProgressUser.id } }),
    ).resolves.not.toBeNull();

    await page.getByRole("button", { name: "Delete account" }).click();
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    // Back on the home page, signed out, with a word that it's done.
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    await expect(
      page.getByRole("region", { name: "Notifications" }).getByText("Your account was deleted."),
    ).toBeVisible();

    await expect
      .poll(() => prisma.user.findUnique({ where: { id: noProgressUser.id } }))
      .toBeNull();

    await expect(prisma.goal.count({ where: { userId: noProgressUser.id } })).resolves.toBe(0);

    // What their study teaches every learner stays, with nothing that points back at them.
    const kept = await Promise.all([
      prisma.anonymousFirstAnswer.findMany({ where: { itemId: study.item.id } }),
      prisma.anonymousMockAnswer.findMany({ where: { examBlueprintId: study.blueprint.id } }),
      prisma.anonymousLessonPace.findMany({ where: { lessonId: study.lesson.id } }),
      prisma.anonymousExamResult.findMany({ where: { examBlueprintId: study.blueprint.id } }),
    ]);

    expect(kept).toMatchObject([
      [{ isCorrect: false }],
      [{ durationMs: 95_000 }],
      [{ seconds: 200 }],
      [{ estimateHigh: 700, estimateLow: 640, scale: "irt", score: 690 }],
    ]);

    expect(JSON.stringify(kept)).not.toContain(noProgressUser.id);
    expect(JSON.stringify(kept)).not.toContain(study.mock.id);

    // Their feedback stays for the team, without their email.
    await expect(
      prisma.feedback.findUnique({ where: { id: study.feedback.id } }),
    ).resolves.toMatchObject({ email: null, message: FEEDBACK, userId: null });
  });

  test("drops the deleted account from the browser's other tabs, as logging out does", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const context = await browser.newContext({ storageState: user.storageState });

    try {
      const [catalog, profile] = await Promise.all([context.newPage(), context.newPage()]);
      await catalog.setViewportSize({ height: 900, width: 1440 });
      await catalog.goto("/courses");

      const sidebar = catalog.getByRole("complementary", { name: "Sidebar" });
      await expect(sidebar.getByRole("button", { name: /User menu$/u })).toBeVisible();

      // The deletion itself tells the other tabs: this tab's own summary reads never answer, as the
      // answer of one (the read its refreshed seed asks for, or the home page's after it) would
      // tell them too. Its first summary comes from the page's seed.
      await profile.route("**/api/learner/summary", () => {});
      await profile.goto("/profile");
      await profile.getByRole("button", { name: "Delete account" }).click();

      await profile
        .getByRole("alertdialog", { name: "Delete your account?" })
        .getByRole("button", { name: "Delete my account" })
        .click();

      await expect(
        profile
          .getByRole("region", { name: "Notifications" })
          .getByText("Your account was deleted."),
      ).toBeVisible();

      // The other tab, never reloaded, lets the account go as when the learner logs out.
      await expect(sidebar.getByRole("link", { name: "Log in" })).toBeVisible();
      await expect(sidebar.getByRole("button", { name: /User menu$/u })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
