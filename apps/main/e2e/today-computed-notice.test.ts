import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

/** A calendar day as plans label it (YYYY-MM-DD); the seed's dates are UTC midnights. */
function toDayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A share as the card says it: a whole percentage ("54%"). */
function sayShare(share: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0, style: "percent" }).format(share);
}

/** What Today's own view read says: its revision and the plan change it carries. */
async function readTodayNotice(page: Page) {
  const response = await page.request.get("/api/learner/views/today");
  const body = await response.json();

  return { change: body.copy.view.today.planChange, revision: body.copy.revision };
}

test.describe("A plan change Today works out on its own", () => {
  test("asks about falling behind before any tap, and Keep my time saves it once without starting the day", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    // A missed day the read settles on its own puts the goal's date at risk.
    const seed = await mandatoryNoticeDayFixture({
      atRisk: true,
      localDate: toUTCMidnight(new Date()),
      userId: user.id,
    });

    // The goal's day is the server's UTC day, and the browser is in UTC too, so nothing follows a zone.
    const context = await browser.newContext({
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    const page = await context.newPage();
    const actions: string[] = [];

    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        actions.push(request.url());
      }
    });

    try {
      await page.goto("/today");

      const main = page.getByRole("main");
      const notice = main.getByRole("region", { name: "Plan change" });
      const keep = notice.getByRole("button", { exact: true, name: "Keep my time" });
      await expect(keep).toBeVisible();
      await expect(main.getByRole("button", { name: "Undo" })).toHaveCount(0);

      // Today worked the change out on its own read: nothing about it is saved yet.
      const shown = await readTodayNotice(page);
      expect(shown.change).toMatchObject({ id: null, kind: "missedDays", status: "applied" });

      await expect(
        notice.getByRole("heading", {
          name: `At 12 min a day, your plan now covers ${sayShare(shown.change.behind.coveredAfter)} of your goal, down from 100%.`,
        }),
      ).toBeVisible();

      // It's a rest day in the plan, and Today says so alongside the question.
      await expect(main.getByText("No study planned today.")).toBeVisible();
      await expect(main.getByRole("button", { name: /^(?:Start|Continue)/u })).toHaveCount(0);

      expect(actions).toEqual([]);
      await expect(prisma.planChange.count({ where: { planId: seed.plan.id } })).resolves.toBe(0);

      await keep.click();

      await expect(notice.getByRole("status")).toHaveText(
        "Noted. You keep your time, with less depth where it counts least.",
      );

      // One ask saved it, for the copy that showed it; the day wasn't started.
      await expect.poll(() => prisma.planChange.count({ where: { planId: seed.plan.id } })).toBe(1);
      const saved = await prisma.planChange.findFirstOrThrow({ where: { planId: seed.plan.id } });

      expect(saved).toMatchObject({ kind: "missedDays", status: "applied" });

      expect(saved.payload).toMatchObject({
        acknowledgedRead: { revision: shown.revision, studyDay: toDayLabel(seed.localDate) },
        behind: { coveredBefore: 1 },
        seenAt: expect.any(String),
      });

      expect(actions).toHaveLength(1);
      await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);

      await page.reload();
      await expect(main.getByText("No study planned today.")).toBeVisible();
      await expect(notice).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
