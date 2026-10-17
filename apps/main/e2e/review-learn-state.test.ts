import { type Browser } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { openAs } from "./study-day";
import { routeTimeToCover } from "./time-to-cover-routes";

async function openBasesPlan(browser: Browser) {
  const user = await createE2EUser(getBaseURL());

  const fixture = await goalWithBasesFixture({
    days: 30,
    details: { answered: [...ONBOARDING_QUESTIONS, "buddy", "placement"] },
    kind: "exam",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  const page = await openAs(browser, user);
  await page.goto("/today");

  // Starting the day Today shows (a POST) lays out the plan the goal's run handed over. The tap
  // moves to the session before its POST answers; the day's session commits with the plan.
  await page
    .getByRole("region", { name: "Today's session" })
    .getByRole("button", { name: /^Start/u })
    .click();

  await expect
    .poll(() => prisma.studySession.count({ where: { goalId: fixture.goal.id } }))
    .toBe(1);

  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  return { ...fixture, page };
}

test("a mandatory mock answer blocks both the map and answer sheet until answered", async ({
  browser,
}) => {
  const { answers, user } = await createAnytimeMockLearner({ navigation: true, plus: true });
  const page = await openAs(browser, user);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/mock/new");
  await page.getByRole("button", { name: "Start" }).click();
  const sheet = page.getByRole("complementary", { name: "Answer sheet" });
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(sheet.getByRole("button", { exact: true, name: "Question 2" })).toBeDisabled();
  await page.setViewportSize({ height: 844, width: 390 });
  const map = page.getByRole("list", { name: "Questions" }).filter({ visible: true });
  await expect(map.getByRole("button", { exact: true, name: "Question 2" })).toBeDisabled();
  const heading = await page.getByRole("main").getByRole("heading", { level: 2 }).innerText();
  await page.getByRole("radio", { name: answers.get(heading.trim())?.right }).click();
  await map.getByRole("button", { exact: true, name: "Question 2" }).click();
  await expect(page.getByText(/^Question 2 of 16/u)).toBeVisible();
  await expect(map.getByRole("button", { exact: true, name: "Question 1" })).toBeDisabled();
  await page.context().close();
});

test("coverage Apply requires a fresh preview after Adjust plan changes the schedule", async ({
  browser,
}) => {
  const { goal, page } = await openBasesPlan(browser);
  await page.setViewportSize({ height: 900, width: 1440 });

  // Main's E2E runs without the API: Find's search answers an hour a day, more than her 15 minutes
  // and the 30 she picks later, so each Find previews a change.
  await routeTimeToCover(page, {
    goalId: goal.id,
    time: {
      recommendedMinutes: 60,
      targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
    },
  });

  const suggestion = page
    .getByRole("group", { exact: true, name: "Plan suggestion" })
    .filter({ visible: true });

  const find = suggestion.getByRole("button", {
    exact: true,
    name: "Find the time that covers everything",
  });

  const apply = suggestion.getByRole("button", { exact: true, name: "Apply" });

  // Find previews the change it finds at once.
  await find.click();
  await expect(apply).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
  await page.getByRole("button", { name: "Adjust plan" }).click();
  const editor = page.getByRole("dialog", { name: "Adjust your plan" });

  await editor
    .getByRole("radiogroup", { name: "Time a day" })
    .getByText("30 min", { exact: true })
    .click();

  await expect
    .poll(async () =>
      prisma.goal.findUniqueOrThrow({ select: { dailyMinutes: true }, where: { id: goal.id } }),
    )
    .toMatchObject({ dailyMinutes: 30 });

  await expect(editor.getByRole("status")).toBeVisible();
  await editor.getByRole("button", { name: "Close" }).click();

  // The preview was for the plan before the change: it can't be applied, and Find previews again.
  await expect(apply).toHaveCount(0);
  await find.click();
  await expect(apply).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
  await apply.click();
  await expect(suggestion.getByText("Plan updated", { exact: true })).toBeVisible();
  await page.context().close();
});

test("a failed prerequisite preview is retryable and cannot save choices", async ({ browser }) => {
  const { area, goal, page } = await openBasesPlan(browser);
  await page.getByRole("button", { name: "Adjust plan" }).click();
  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  await editor.getByRole("button", { name: "Choose prerequisites" }).click();
  const sheet = page.getByRole("dialog", { name: "Prerequisites" });
  const release = Promise.withResolvers<boolean>();
  const requested = Promise.withResolvers<boolean>();
  // A transport failure cannot safely be induced through the real database. Fail only the
  // browser's preview request; retry and saving still exercise real actions and persistence.
  await page.route("**/*", async (route) => {
    const request = route.request();

    if (request.headers()["next-action"] && request.postData()?.includes("setBaseChoices")) {
      requested.resolve(true);
      await release.promise;
      await route.abort("failed");
      return;
    }

    await route.continue();
  });

  await sheet
    .getByRole("group", { exact: true, name: area })
    .getByRole("button", { name: /^In depth/u })
    .click();

  await requested.promise;
  await expect(sheet.getByRole("button", { name: "Save choices" })).toBeDisabled();
  release.resolve(true);
  await expect(sheet.getByText("We couldn't check what changes.")).toBeVisible();
  await expect(sheet.getByText("Your plan stays as it is.")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Save choices" })).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await sheet.getByRole("button", { name: "Try again" }).click();
  await expect(sheet.getByRole("button", { name: "Save choices" })).toBeEnabled();
  await sheet.getByRole("button", { name: "Save choices" }).click();
  await expect(sheet.getByRole("status")).toBeVisible();

  await expect
    .poll(async () =>
      prisma.plan.findUniqueOrThrow({ select: { settings: true }, where: { goalId: goal.id } }),
    )
    .toMatchObject({
      settings: {
        baseChoices: expect.arrayContaining([expect.objectContaining({ choice: "deep" })]),
      },
    });

  await page.context().close();
});

test("a prerequisite preview carries on when the Plan reads itself again unchanged", async ({
  browser,
}) => {
  const { area, goal, page } = await openBasesPlan(browser);
  await page.getByRole("button", { name: "Adjust plan" }).click();
  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  await editor.getByRole("button", { name: "Choose prerequisites" }).click();
  const sheet = page.getByRole("dialog", { name: "Prerequisites" });
  const save = sheet.getByRole("button", { name: "Save choices" });
  const first = Promise.withResolvers<boolean>();
  const later = Promise.withResolvers<boolean>();
  const requested = Promise.withResolvers<boolean>();
  const previews: string[] = [];

  try {
    await page.clock.install();

    // The first preview waits until the Plan's read is queued; a second one, which the read must
    // not start, would never answer. Both still reach the real action.
    await page.route("**/*", async (route) => {
      const request = route.request();

      if (request.headers()["next-action"] && request.postData()?.includes("setBaseChoices")) {
        previews.push(request.postData() ?? "");
        requested.resolve(true);
        await (previews.length === 1 ? first.promise : later.promise);
      }

      await route.continue();
    });

    await sheet
      .getByRole("group", { exact: true, name: area })
      .getByRole("button", { name: /^In depth/u })
      .click();

    await page.clock.fastForward(350);
    await requested.promise;

    // The Plan reads itself again in the background (an old copy shown again, lessons being
    // written) and gets the same plan. Next's router refresh is that read, and it lands after the
    // preview's answer. The goal's new name shows when it landed, without changing the plan.
    await prisma.goal.update({ data: { title: "Read again" }, where: { id: goal.id } });

    await page.evaluate(() => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Next exposes its router on the window; the test reads the page again with it, as the app's background reads do.
      (
        globalThis as unknown as { next: { router: { refresh: () => void } } }
      ).next.router.refresh();
    });

    first.resolve(true);
    await expect(page.getByText("Read again").first()).toBeAttached();
    await page.clock.fastForward(1000);

    await expect(save).toBeEnabled();
    await expect(sheet.getByText("Checking what changes…")).toHaveCount(0);
    expect(previews).toHaveLength(1);
  } finally {
    first.resolve(true);
    later.resolve(true);
    await page.unrouteAll({ behavior: "wait" });
    await page.context().close();
  }
});

test("an unavailable prerequisite preview eventually offers retry instead of blocking forever", async ({
  browser,
}) => {
  const { area, page } = await openBasesPlan(browser);
  await page.getByRole("button", { name: "Adjust plan" }).click();
  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  await editor.getByRole("button", { name: "Choose prerequisites" }).click();
  const sheet = page.getByRole("dialog", { name: "Prerequisites" });
  const release = Promise.withResolvers<boolean>();
  const requested = Promise.withResolvers<boolean>();

  try {
    await page.clock.install();
    // A pending transport reproduces an unavailable preview without breaking the database.
    await page.route("**/*", async (route) => {
      const request = route.request();

      if (request.headers()["next-action"] && request.postData()?.includes("setBaseChoices")) {
        requested.resolve(true);
        await release.promise;
        await route.abort("failed");
        return;
      }

      await route.continue();
    });

    await sheet
      .getByRole("group", { exact: true, name: area })
      .getByRole("button", { name: /^In depth/u })
      .click();

    await page.clock.fastForward(350);
    await requested.promise;
    await expect(sheet.getByRole("button", { name: "Save choices" })).toBeDisabled();
    await page.clock.fastForward(60_000);
    await expect(sheet.getByText("We couldn't check what changes.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Try again" })).toBeEnabled();
    await expect(sheet.getByRole("button", { name: "Save choices" })).toBeDisabled();
    release.resolve(true);
    await page.unrouteAll({ behavior: "wait" });
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet.getByRole("button", { name: "Save choices" })).toBeEnabled();
  } finally {
    release.resolve(true);
    await page.context().close();
  }
});
