import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { unplannedCheckpointFixture } from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";

const execFileAsync = promisify(execFile);

/**
 * A learner whose plan selected its phase's challenge but saved no row for it yet (as a plan saved
 * before the challenge was selected): core's planner builds the plan in a process of its own, since
 * Playwright can't load core's server code.
 */
async function createUnsavedCheckpoint() {
  const user = await createE2EUser(getBaseURL());
  const day = await unplannedCheckpointFixture({ userId: user.id });

  await execFileAsync(
    "pnpm",
    [
      "--filter",
      "@zoonk/core",
      "--silent",
      "exec",
      "tsx",
      "--conditions=react-server",
      "--import=./scripts/seed/node-runtime.mjs",
      "scripts/seed/e2e-unsaved-checkpoint.ts",
      "--goal",
      day.goal.id,
      "--plan",
      day.plan.id,
      "--graph",
      JSON.stringify(day.graph),
    ],
    { env: { ...process.env, NEXT_PUBLIC_APP_DOMAIN: "localhost:3000" } },
  );

  return { day, user };
}

test.describe("A phase challenge the plan hasn't saved yet", () => {
  test("shows its day without a link, then opens its page once the day is opened", async ({
    browser,
  }) => {
    const { user } = await createUnsavedCheckpoint();

    const context = await browser.newContext({
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    const page = await context.newPage();

    // Lessons aren't written in this plan: nothing here may ask for one.
    await page.route("**/v1/library/lessons/*/generations", (route) => route.abort());

    await page.goto("/plan");

    const main = page.getByRole("main");
    const label = main.getByText("Phase challenge", { exact: true }).first();

    // Its row says when, like every row on the path, and opens nothing: there's no page yet.
    await expect(label).toBeVisible();
    await expect(main.getByRole("link", { name: /^Phase challenge/u })).toHaveCount(0);
    await expect(label.locator("xpath=../..")).toContainText(/\d/u);

    // Opening the day (the session screen opens it on its own, asking for nothing) saves it.
    await page.goto("/session");
    await expect.poll(() => prisma.studySession.count({ where: { userId: user.id } })).toBe(1);

    await page.goto("/plan");

    await expect(main.getByRole("link", { name: /^Phase challenge/u }).first()).toHaveAttribute(
      "href",
      /\/challenge\/[\w-]+$/u,
    );

    await context.close();
  });
});
