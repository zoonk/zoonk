import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { formatDuration } from "@zoonk/utils/duration";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { unfundableMockMoveFixture } from "../../../packages/core/src/plans/_test-utils/unfundable-mock-move";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/** Minutes written with a fraction ("14.875 min", "14,9 min"): the shared formatter rounds them. */
const RAW_MINUTES = /\d+[.,]\d+\s*min/u;

const CHALLENGE_PATH = /\/challenge\/(?<id>[\da-f-]{36})$/u;

/** The plan's saved funding (`PlanSettings.mockFunding`): each mock's day, length and savings. */
const fundingSchema = z.array(
  z.object({
    contributions: z.array(z.object({ date: z.string(), minutes: z.number() })),
    date: z.string(),
    minutes: z.number(),
  }),
);

async function readFunding(goalId: string) {
  const plan = await prisma.plan.findFirstOrThrow({ where: { goalId } });
  return fundingSchema.parse(isJsonObject(plan.settings) ? plan.settings.mockFunding : []);
}

async function readFundedDays(goalId: string): Promise<string[]> {
  const funding = await readFunding(goalId);
  return funding.map((entry) => entry.date);
}

/** A plan item's day ("YYYY-MM-DD"), as the plan's saved funding names it. */
function toIsoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** A duration as the app writes it everywhere, in whole minutes (`formatDuration`). */
function shownDuration(minutes: number): string {
  return formatDuration({ locale: "en", totalSeconds: minutes * 60 });
}

test.describe("A long mock the plan saves time for", () => {
  test("explains an unfundable move and keeps the mock and plan on their original days", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const { goal, mock, plan } = await unfundableMockMoveFixture(user.id);
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const readSaved = () =>
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      });

    const page = await openAs(browser, user);
    // Resolve the learner's current day before taking the move's exact persistence baseline.
    // The shell prefetches Today, which can refresh this older fixture's saved plan.
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await page.goto(`/challenge/${mock.id}`);
    const move = page.getByRole("button", { name: "Move to Monday" });
    await expect(move).toBeVisible();
    const before = await readSaved();
    await move.click();

    await expect(page.getByText(/Not enough study time before/u)).toContainText(shownDuration(330));

    await expect(page.getByText(/Pick a later day/u)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/challenge/${mock.id}$`, "u"));
    await expect(readSaved()).resolves.toStrictEqual(before);
    await page.context().close();
  });

  test("shows its real length on the Plan, opens its intro before its day, and moves with its saved time", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.goto("/plan");

      const row = page
        .getByRole("region", { name: "Next on your path" })
        .getByRole("link", { name: /^Mock exam/u });

      await expect(row).toHaveAttribute("href", CHALLENGE_PATH);

      const href = await row.getAttribute("href");
      const planItemId = CHALLENGE_PATH.exec(href ?? "")?.groups?.id ?? "";
      const item = await prisma.planItem.findUniqueOrThrow({ where: { id: planItemId } });
      const day = toIsoDay(item.scheduledFor);
      const funding = await readFunding(user.goalId);
      const entry = funding.find((saved) => saved.date === day);

      // Her next mock is long and the plan already saves time for it, on days that set aside
      // fractions of a minute: the row says its real length the way every duration reads.
      expect(item.kind).toBe("mock");
      expect(entry).toBeDefined();

      expect(
        funding
          .flatMap((saved) => saved.contributions)
          .some(({ minutes }) => !Number.isInteger(minutes)),
      ).toBe(true);

      await expect(row).toContainText(shownDuration(entry?.minutes ?? 0));
      await expect(page.getByRole("main")).not.toContainText(RAW_MINUTES);

      // Today says why it's lighter, in whole minutes like every other time on it.
      await page.goto("/today");
      await expect(page.getByText(/^Lighter day: saving time for .+'s mock exam$/u)).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText(RAW_MINUTES);

      // Its intro opens days before the mock, with the way to give it another day.
      await page.goto("/plan");
      await row.click();
      await expect(page).toHaveURL(new RegExp(`/challenge/${planItemId}$`, "u"));

      // The intro says the same length the plan saves for it, the exam's clock, never a guess.
      const intro = page.getByRole("main");
      await expect(intro).toContainText(shownDuration(entry?.minutes ?? 0));
      await expect(intro).not.toContainText(/About \d+ (?:hr|min)/u);

      const move = page.getByRole("button", { name: "Move to Monday" });
      await expect(move).toBeVisible();
      await move.click();

      // The move opens the mock on its new day, a Monday, whether core kept its item or planned a
      // new one there: the screen's item is the one to follow.
      const readShownItem = async () => {
        const shownId = CHALLENGE_PATH.exec(new URL(page.url()).pathname)?.groups?.id ?? "";
        return prisma.planItem.findUnique({ where: { id: shownId } });
      };

      await expect
        .poll(async () => {
          const shown = await readShownItem();
          return shown?.scheduledFor?.getUTCDay() === 1 && toIsoDay(shown.scheduledFor) !== day;
        })
        .toBe(true);

      const moved = await readShownItem();
      const movedDay = toIsoDay(moved?.scheduledFor ?? null);

      expect(moved).toMatchObject({ kind: "mock", status: "todo" });

      // The time the plan saves for it moved with it.
      await expect.poll(() => readFundedDays(user.goalId)).toContain(movedDay);
      await expect(readFundedDays(user.goalId)).resolves.not.toContain(day);

      const movedLedger = await readFunding(user.goalId);
      const movedFunding = movedLedger.find((saved) => saved.date === movedDay);

      expect(movedFunding).toBeDefined();

      // The result confirms the move first. Reopen its actual intro through the learner's Plan.
      await page.getByRole("link", { exact: true, name: "Back to Today" }).click();
      await page.goto("/plan");
      await expect(row).toHaveAttribute("href", `/challenge/${moved?.id}`);
      await expect(row).toContainText(shownDuration(movedFunding?.minutes ?? 0));
      await row.click();
      await expect(intro).toContainText(shownDuration(movedFunding?.minutes ?? 0));
      await expect(intro).not.toContainText(RAW_MINUTES);
    });
  });
});
