import { type Locator } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

function readPlan(goalId: string) {
  return prisma.plan.findUniqueOrThrow({
    select: { phases: true, version: true },
    where: { goalId },
  });
}

function readGoal(goalId: string) {
  return prisma.goal.findUniqueOrThrow({
    select: { status: true, title: true },
    where: { id: goalId },
  });
}

/** The lines of a plan diff that say what a change makes of the plan. */
function findMoves(scope: Locator) {
  return scope.getByRole("listitem").filter({ hasText: "After the change:" });
}

async function readGoalStatus(goalId: string) {
  const goal = await readGoal(goalId);
  return goal.status;
}

test.describe("resuming a paused goal", () => {
  // Marcos paused by mistake and resumed a minute later: his second phase lost three lessons and
  // five days without a word. A pause that left nothing behind keeps the plan, with nothing to ask.
  test("keeps the plan as it was when the learner resumes the day they paused", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      await page.goto("/today");
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await page.goto("/plan");
      await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

      const before = await readPlan(user.goalId);
      const { title } = await readGoal(user.goalId);
      const openMenu = () => page.getByRole("button", { name: "Plan options" }).click();

      await openMenu();
      await page.getByRole("menuitem", { name: "Pause this goal" }).click();

      // Nothing to show: the line resumes on its own, with no diff to read first.
      const notice = page.getByRole("region", { name: `${title} is paused` });
      await expect(notice).toContainText("Nothing is planned until you resume it.");
      await expect(notice.getByRole("list")).toHaveCount(0);

      await openMenu();
      await page.getByRole("menuitem", { name: "Resume this goal" }).click();

      await expect.poll(() => readGoalStatus(user.goalId)).toBe("active");
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(readPlan(user.goalId)).resolves.toStrictEqual(before);
    });
  });

  // Back after days the plan had lessons on, resuming plans again from today: the learner sees
  // what that moves wherever they resume, before they do.
  test("says what resuming moves before the learner resumes after days away", async ({
    browser,
  }) => {
    await asPersona(browser, { away: 4, persona: "language" }, async ({ page, user }) => {
      await prisma.goal.update({ data: { status: "paused" }, where: { id: user.goalId } });
      const { title } = await readGoal(user.goalId);
      const before = await readPlan(user.goalId);

      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/plan");

      // What resuming moves, before Resume: the plan's dates now and after it.
      const panel = page.getByRole("region", { name: `${title} is paused` });
      await expect(findMoves(panel)).not.toHaveCount(0);

      // The "…" has no room for what changes, so it asks first; Cancel keeps the goal paused.
      await page.getByRole("button", { name: "Plan options" }).click();
      await page.getByRole("menuitem", { name: "Resume this goal" }).click();

      const confirm = page.getByRole("alertdialog");
      await expect(findMoves(confirm)).not.toHaveCount(0);
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await expect(confirm).toBeHidden();
      await expect(readGoalStatus(user.goalId)).resolves.toBe("paused");
      await expect(readPlan(user.goalId)).resolves.toStrictEqual(before);

      // Today says it too, beside the one tap that resumes.
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      await expect(
        page.getByRole("status").filter({ hasText: `${title} is paused.` }),
      ).toContainText("Nothing is planned until you resume it.");

      await expect(findMoves(page.getByRole("main"))).not.toHaveCount(0);
      await page.getByRole("button", { name: `Resume ${title}` }).click();
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await expect.poll(() => readGoalStatus(user.goalId)).toBe("active");

      // Its paused days' lessons come first, without counting as missed days: he isn't behind.
      const changes = await prisma.planChange.findMany({
        where: { plan: { goalId: user.goalId } },
      });

      expect(changes.filter((change) => change.kind === "resumed")).toHaveLength(1);
      expect(changes.filter((change) => change.kind === "missedDays")).toHaveLength(0);
    });
  });
});
