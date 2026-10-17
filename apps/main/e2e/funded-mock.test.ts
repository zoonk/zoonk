import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { formatDuration } from "@zoonk/utils/duration";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { unfundableMockMoveFixture } from "../../../packages/core/src/plans/_test-utils/unfundable-mock-move";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

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
    // Every GET and tab prefetch preserves this announced mock; only a learner POST may save a plan.
    const before = await readSaved();
    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(readSaved()).resolves.toStrictEqual(before);
    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);

    await page.goto(`/challenge/${mock.id}`);
    const move = page.getByRole("button", { name: "Move to Monday" });
    await expect(move).toBeVisible();
    await expect(readSaved()).resolves.toStrictEqual(before);

    await page.goto("/plan");
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
    await expect(readSaved()).resolves.toStrictEqual(before);
    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);

    await page.goto(`/challenge/${mock.id}`);
    await expect(move).toBeVisible();
    await move.click();

    const refused = page.getByText(/^Your plan can't make room for this/u);
    await expect(refused).toContainText(shownDuration(330));

    // Monday is this screen's only move, so it says the mock stays instead of asking for a day.
    await expect(refused).toContainText("It stays where it is.");
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

  // Back after days away on a day that also saves time for a mock, the greeting said the day was
  // lighter and nothing said part of it went to the mock: Today hid the reason to keep one message.
  test("a day back that also saves time for a mock says so beside the greeting, without a second lighter day", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const today = toUTCMidnight(new Date());
    const mockDay = new Date(today.getTime() + 3 * MS_PER_DAY);

    await planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 1,
      scheduledFor: mockDay,
      titleSnapshot: "Full mock",
    });

    await prisma.plan.update({
      data: {
        settings: {
          ...(isJsonObject(plan.settings) ? plan.settings : {}),
          mockFunding: [
            {
              contributions: [{ date: toIsoDay(today), minutes: 5 }],
              date: toIsoDay(mockDay),
              minutes: 165,
            },
          ],
        },
      },
      where: { id: plan.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(
      page
        .getByRole("region", { name: "Today's session" })
        .getByText(/^Welcome back! Today is lighter, about .+, so it's easy to pick up again\.$/u),
    ).toBeVisible();

    // The greeting already says the day is lighter: the date line says what it saves time for.
    await expect(page.getByText(/^Saving time for .+'s mock exam$/u)).toBeVisible();
    await expect(page.getByRole("main").getByText(/Lighter day/u)).toHaveCount(0);
    await page.context().close();
  });
});
