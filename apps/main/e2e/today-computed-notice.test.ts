import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

type PhaseEndMove = { after: string; before: string; name: string };

/** A calendar day as plans label it (YYYY-MM-DD); the seed's dates are UTC midnights. */
function toDayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A plan day as the notice says it ("October 21"), read in UTC like every plan label. */
function sayPlanDay(day: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** What Today's own view read says: its revision and where the change moved the phase's end. */
async function readTodayNotice(page: Page, phase: string) {
  const response = await page.request.get("/api/learner/views/today");
  const body = await response.json();
  const view = body.copy.view.today;
  const moves: PhaseEndMove[] = view.planChange.effect.phaseEnds;

  return {
    id: view.planChange.id,
    move: moves.find((move) => move.name === phase),
    revision: body.copy.revision,
  };
}

test.describe("A plan change Today works out on its own", () => {
  test("shows with its new dates before any tap, and Got it saves it once without starting the day", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const seed = await mandatoryNoticeDayFixture({
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
      const gotIt = main.getByRole("button", { exact: true, name: "Got it" });
      await expect(gotIt).toBeVisible();
      await expect(main.getByRole("button", { name: "Undo" })).toHaveCount(0);

      // Today worked the change out on its own read: nothing about it is saved yet.
      const shown = await readTodayNotice(page, seed.phaseName);
      expect(shown.id).toBeNull();
      expect(shown.move?.before).toBe(toDayLabel(seed.before));

      const sentence = `${seed.phaseName} ends ${sayPlanDay(shown.move?.after ?? "")} instead of ${sayPlanDay(toDayLabel(seed.before))}.`;
      await expect(main.getByText(sentence).filter({ visible: true })).toBeVisible();

      // It's a rest day in the plan, and Today says so alongside the change.
      await expect(main.getByText("No study planned today.")).toBeVisible();
      await expect(main.getByRole("button", { name: /^(?:Start|Continue)/u })).toHaveCount(0);

      expect(actions).toEqual([]);
      await expect(prisma.planChange.count({ where: { planId: seed.plan.id } })).resolves.toBe(0);

      await gotIt.click();
      await expect(main.getByText("Noted.").filter({ visible: true })).toBeVisible();

      // One ask saved it, for the copy that showed it; the day wasn't started.
      await expect.poll(() => prisma.planChange.count({ where: { planId: seed.plan.id } })).toBe(1);
      const saved = await prisma.planChange.findFirstOrThrow({ where: { planId: seed.plan.id } });

      expect(saved.payload).toMatchObject({
        acknowledgedRead: { revision: shown.revision, studyDay: toDayLabel(seed.localDate) },
        seenAt: expect.any(String),
      });

      expect(actions).toHaveLength(1);
      await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);

      await page.reload();
      await expect(main.getByText("No study planned today.")).toBeVisible();
      await expect(main.getByRole("button", { exact: true, name: "Got it" })).toHaveCount(0);
      await expect(main.getByText(sentence)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
