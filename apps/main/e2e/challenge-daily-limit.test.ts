import { type Page, type TestInfo } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { toUTCMidnight } from "@zoonk/utils/date";
import { createCheckpointLearner } from "./checkpoint-fixtures";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { watchStart } from "./start-watch";
import { openAs } from "./study-day";

const STUDY_TIME_USED_UP = "You've reached today's study time. It'll be here tomorrow.";
const START_FAILED = "That didn't go through. Try again in a moment.";

/** The same line and way back as the French, German and Portuguese catalogs say them. */
const STUDY_TIME_USED_UP_IN = {
  de: {
    back: "Zurück zu Heute",
    line: "Du hast deine Lernzeit für heute erreicht. Morgen geht es hier weiter.",
  },
  fr: {
    back: "Retour à Aujourd'hui",
    line: "Tu as atteint ta limite de temps d’étude pour aujourd’hui. Ce sera de nouveau disponible demain.",
  },
  pt: {
    back: "Voltar para Hoje",
    line: "Você já atingiu seu limite de tempo de estudo de hoje. O desafio fica para amanhã.",
  },
} as const;

/** Today's study time under a 30-minute daily limit, all used. */
async function useUpTodaysStudyTime(userId: string) {
  await Promise.all([
    prisma.userLearningProfile.upsert({
      create: { dailyLimitMinutes: 30, userId },
      update: { dailyLimitMinutes: 30 },
      where: { userId },
    }),
    dailyProgressFixtureMany([
      { date: toUTCMidnight(new Date()), timeSpentSeconds: 30 * 60, userId },
    ]),
  ]);
}

/** The intro's footer once today's study time is used up: when it's back, and the way home. */
async function expectStudyTimeUsedUp(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: STUDY_TIME_USED_UP })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
}

async function captureAt(
  page: Page,
  testInfo: TestInfo,
  { colorScheme, name, width }: { colorScheme: "dark" | "light"; name: string; width: number },
) {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ height: 900, width });

  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`challenge-${name}-${width}-${colorScheme}.png`),
  });
}

/**
 * The used-up footer as the design review sees it: on a phone and a desktop, light and dark, then
 * the same line and way back in French, German and Portuguese on a phone, where the longest labels
 * have to fit. It ends back in the light scheme.
 */
async function captureStudyTimeUsedUp({
  name,
  page,
  planItemId,
  testInfo,
}: {
  name: string;
  page: Page;
  planItemId: string;
  testInfo: TestInfo;
}) {
  for (const width of [390, 1440]) {
    for (const colorScheme of ["light", "dark"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One page shows one size and scheme at a time.
      await captureAt(page, testInfo, { colorScheme, name, width });
    }
  }

  for (const lang of ["fr", "de", "pt"] as const) {
    const { back, line } = STUDY_TIME_USED_UP_IN[lang];
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await page.goto(`/${lang}/challenge/${planItemId}`);
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await expect(page.getByRole("status").filter({ hasText: line })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await expect(page.getByRole("link", { name: back })).toBeVisible();

    for (const colorScheme of ["light", "dark"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One page shows one scheme at a time.
      await captureAt(page, testInfo, { colorScheme, name: `${name}-${lang}`, width: 390 });
    }
  }

  await page.emulateMedia({ colorScheme: "light" });
}

test("a challenge intro opened past today's study time says when it's back, with no Start to tap", async ({
  browser,
}, testInfo) => {
  const { block, boss, user } = await createCheckpointLearner();
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  await expectStudyTimeUsedUp(page);
  await captureStudyTimeUsedUp({ name: "daily-limit", page, planItemId: boss.id, testInfo });
  await page.goto(`/challenge/${boss.id}`);

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "pending" });

  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await page.context().close();
});

test("the week's mock exam past today's study time still offers Move to Monday with the way back to Today", async ({
  browser,
}, testInfo) => {
  const { boss, user } = await createCheckpointLearner({ kind: "weekly", planned: true });
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  await expectStudyTimeUsedUp(page);

  // Moving the week's challenge (here its mock) changes the plan, not today's study, so it stays.
  // Not tapped here: the move itself is checkpoints.test.ts's "Move to Monday" flow.
  await expect(page.getByRole("button", { name: "Move to Monday" })).toBeEnabled();

  await captureStudyTimeUsedUp({ name: "daily-limit-weekly", page, planItemId: boss.id, testInfo });
  await page.context().close();
});

test("a challenge refused at today's study time offers Start again once the learner lifts the limit", async ({
  browser,
}) => {
  const { boss, user } = await createCheckpointLearner();
  const page = await openAs(browser, user);
  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  await today.getByRole("button", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"));
  const start = page.getByRole("button", { exact: true, name: "Start" });
  await expect(start).toBeVisible();

  // Meanwhile today's study time ran out: Start says so, as opening the page would. From the tap
  // on, while the page is read again, Start never shows ready again and no failure shows.
  await useUpTodaysStudyTime(user.id);

  const readSeen = await watchStart(page, start, {
    failure: START_FAILED,
    label: /^Start(?!ing)/u,
  });

  await start.click();
  await expectStudyTimeUsedUp(page);

  await expect(readSeen()).resolves.toMatchObject({
    busy: true,
    failure: 0,
    readyAgain: 0,
    tapped: true,
  });

  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  // Every step stays in the app, so the challenge's screen is kept for coming back.
  const palette = await openPaletteWithKeyboard(page, /Search/iu);
  await palette.getByRole("combobox", { name: /Search/iu }).fill("language");
  await palette.getByRole("option", { name: /^Language/u }).click();
  await expect(page).toHaveURL(/\/settings\/appearance$/u);

  await page
    .getByRole("combobox", { name: "Daily time limit" })
    .selectOption({ label: "No limit" });

  await expect
    .poll(() => prisma.userLearningProfile.findUnique({ where: { userId: user.id } }))
    .toMatchObject({ dailyLimitMinutes: null });

  await page.getByRole("link", { name: /^Today/u }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await today.getByRole("button", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"));
  await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: STUDY_TIME_USED_UP })).toHaveCount(0);
  await page.context().close();
});
