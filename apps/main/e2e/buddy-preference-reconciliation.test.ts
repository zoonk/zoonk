import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { createGoalLearner } from "./checkpoint-fixtures";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

async function createLearner() {
  const { user } = await createGoalLearner();

  await Promise.all([
    learningProfileFixture({ buddyKind: "zu", userId: user.id }),
    milestoneFixture({ key: "star", kind: "glasses", userId: user.id }),
    learningEventFixture({
      correctAnswers: 8,
      incorrectAnswers: 2,
      kind: "checkpoint",
      lessonKind: "boss",
      userId: user.id,
    }),
    learningEventFixture({ kind: "checkpoint", lessonKind: "weeklyChallenge", userId: user.id }),
    milestoneFixture({ key: "aviator", kind: "glasses", userId: user.id }),
  ]);

  return user;
}

function readBuddy(userId: string) {
  return prisma.userLearningProfile.findUniqueOrThrow({
    select: { buddyGlasses: true, buddyKind: true, buddyName: true },
    where: { userId },
  });
}

async function openGlasses({ name, page }: { name: string; page: Page }) {
  await page
    .getByRole("main")
    .getByRole("button", { name: `More about ${name}` })
    .click();

  await page.getByRole("menuitem", { name: /^Glasses/u }).click();
  const sheet = page.getByRole("dialog", { name: "Glasses" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("returning to Buddy preserves the newer kind and name from Preferences when wearing glasses", async ({
  browser,
}) => {
  const user = await createLearner();
  const page = await openAs(browser, user);

  try {
    await page.goto("/buddy");
    await expect(page.getByRole("heading", { level: 1, name: "Zu" })).toBeVisible();

    // Client navigation retains the Buddy page instead of mounting a fresh copy.
    const palette = await openPaletteWithKeyboard(page, /Search/iu);
    await palette.getByRole("combobox", { name: /Search/iu }).fill("language");
    await palette.getByRole("option", { name: /^Language/u }).click();
    await expect(page).toHaveURL(/\/settings\/appearance$/u);
    await page.getByRole("main").getByRole("button", { exact: true, name: "Change" }).click();

    const editor = page.getByRole("dialog", { name: "Your buddy" });
    await editor.getByRole("radio", { name: /^Otto/u }).click();
    await editor.getByRole("textbox", { name: "Name" }).fill("Octavia");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(() => readBuddy(user.id))
      .toStrictEqual({ buddyGlasses: "round", buddyKind: "otto", buddyName: "Octavia" });

    await page
      .getByRole("navigation", { name: "Learning tabs" })
      .getByRole("link", { name: /^Octavia/u })
      .click();

    await expect(
      page.getByRole("main").getByRole("heading", { level: 1, name: "Octavia" }),
    ).toBeVisible();

    const sheet = await openGlasses({ name: "Octavia", page });
    await sheet.getByRole("radio", { name: "Star" }).click();
    await expect(sheet.getByRole("radio", { name: "Star" })).toBeChecked();

    await expect
      .poll(() => readBuddy(user.id))
      .toStrictEqual({ buddyGlasses: "star", buddyKind: "otto", buddyName: "Octavia" });
  } finally {
    await page
      .context()
      .close()
      .catch(() => {});
  }
});

test("an earlier failed glasses save cannot roll back a newer choice", async ({ browser }) => {
  const user = await createLearner();
  const page = await openAs(browser, user);
  const held = Promise.withResolvers<null>();
  const release = Promise.withResolvers<null>();

  try {
    await page.goto("/buddy");
    const sheet = await openGlasses({ name: "Zu", page });

    // The network boundary reproduces a save failing after a later choice was made.
    await page.route("**/buddy", async (route) => {
      const request = route.request();

      if (
        request.method() === "POST" &&
        request.headers()["next-action"] &&
        request.postData()?.includes('"star"')
      ) {
        held.resolve(null);
        await release.promise;
        await route.abort("internetdisconnected");
        return;
      }

      await route.fallback();
    });

    await sheet.getByRole("radio", { name: "Star" }).click();
    await expect(sheet.getByRole("radio", { name: "Star" })).toBeChecked();
    await held.promise;

    await sheet.getByRole("radio", { name: "Aviator" }).click();
    await expect(sheet.getByRole("radio", { name: "Aviator" })).toBeChecked();
    release.resolve(null);

    // The second save reaching storage proves the first has settled too.
    await expect
      .poll(() => readBuddy(user.id))
      .toStrictEqual({ buddyGlasses: "aviator", buddyKind: "zu", buddyName: null });

    await expect(sheet.getByRole("radio", { name: "Aviator" })).toBeChecked();
    await expect(sheet.getByRole("alert")).toHaveCount(0);
  } finally {
    release.resolve(null);

    await page
      .context()
      .close()
      .catch(() => {});
  }
});
