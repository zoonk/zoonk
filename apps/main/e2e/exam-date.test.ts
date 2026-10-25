import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { routeTimeToCover } from "./time-to-cover-routes";

/**
 * The exam's date is the learner's: the notice's day is offered with one tap wherever the date
 * shows, and the full date can be changed any time. The understanding card and the plan's reveal
 * are covered in `onboarding.test.ts` and `onboarding-plan.test.ts`.
 */

const citation = { passage: "", sourceId: "notice" };

/** A public notice whose one exam day is this one. */
function noticeFixture(day: string) {
  return examBlueprintFixture({
    edition: {
      citations: [],
      dates: [{ citation, date: day, kind: "exam", label: "Exam", startTime: null }],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year: Number(day.slice(0, 4)),
    },
  });
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** "November 8", with the year when it isn't this one, as the app writes a day. */
function longDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const otherYear = date.getUTCFullYear() !== new Date().getUTCFullYear();

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    ...(otherYear ? { year: "numeric" } : {}),
  }).format(date);
}

async function readTargetDate(goalId: string): Promise<string | null> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

test.describe("Exam date", () => {
  test("the exam page says the month the learner named, and takes the notice's day in one tap", async ({
    browser,
  }) => {
    // She said "December"; the notice sets the exam for November 8. Her month stays the plan's.
    const year = new Date().getUTCFullYear() + 1;
    const noticeDay = `${year}-11-08`;

    const [user, blueprint] = await Promise.all([
      createE2EUser(getBaseURL()),
      noticeFixture(noticeDay),
    ]);

    const goal = await goalFixture({
      details: { examMonth: 12, examName: "ENEM", examYear: year },
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(`${year}-12-01T00:00:00Z`),
      timezone: "UTC",
      title: `ENEM ${year}`,
      userId: user.id,
    });

    const [context] = await Promise.all([
      browser.newContext({ storageState: user.storageState, timezoneId: "UTC" }),
      planFixture({ goalId: goal.id }),
    ]);

    const page = await context.newPage();
    await page.goto("/exam");

    await expect(page.getByRole("heading", { level: 1, name: blueprint.name })).toBeVisible();

    // Her month, as a month: no weekday or day she never gave, and no "past editions" estimate.
    // The days left count to it, as about that many.
    await expect(page.getByText(`December ${year}`, { exact: true })).toBeVisible();
    await expect(page.getByText(/^Exam · ~[\d,]+ days left$/u)).toBeVisible();
    await expect(page.getByText(/past editions/u)).toHaveCount(0);

    const offer = page.getByText(`The exam notice says ${longDate(noticeDay)}.`, { exact: true });
    await expect(offer).toBeVisible();

    await page.getByRole("button", { name: "Use this date" }).click();

    await expect(offer).toBeHidden();

    // The notice's day, with its weekday (its year beyond the next twelve months, as every date on
    // the Plan), and the days left to it exactly.
    await expect(page.getByText(new RegExp(`^\\w+, Nov 8(, ${year})?$`, "u"))).toBeVisible();
    await expect(page.getByText(/^Exam · [\d,]+ days left$/u)).toBeVisible();

    await expect.poll(() => readTargetDate(goal.id)).toBe(noticeDay);

    await context.close();
  });

  // DELE has an official guide and calendar, not a public notice: the page never calls it one.
  test("a language certificate's exam page gives its official calendar's day, never a notice's", async ({
    browser,
  }) => {
    const year = new Date().getUTCFullYear() + 1;
    const sitting = `${year}-05-22`;

    const [user, blueprint] = await Promise.all([
      createE2EUser(getBaseURL()),
      noticeFixture(sitting),
    ]);

    const goal = await goalFixture({
      details: { examName: "DELE B2" },
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(`${year}-05-29T00:00:00Z`),
      targetLanguage: "es",
      timezone: "UTC",
      title: "DELE B2",
      userId: user.id,
    });

    const [context] = await Promise.all([
      browser.newContext({ storageState: user.storageState, timezoneId: "UTC" }),
      planFixture({ goalId: goal.id }),
    ]);

    const page = await context.newPage();
    await page.goto("/exam");

    await expect(
      page.getByText(`The exam's official calendar says ${longDate(sitting)}.`, { exact: true }),
    ).toBeVisible();

    await expect(page.getByText(/notice/iu)).toHaveCount(0);

    await context.close();
  });

  test("the exam page says the learner's month has no sitting, and takes the closest in one tap", async ({
    browser,
  }) => {
    // DELE B2 sits in November and April, never in February, which she said.
    const year = new Date().getUTCFullYear() + 1;
    const days = [`${year}-11-14`, `${year + 1}-04-02`];

    const [user, blueprint] = await Promise.all([
      createE2EUser(getBaseURL()),
      examBlueprintFixture({
        edition: {
          citations: [],
          dates: days.map((date) => ({
            citation,
            date,
            kind: "exam",
            label: "Exam",
            startTime: null,
          })),
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year,
        },
      }),
    ]);

    const goal = await goalFixture({
      details: { examName: "DELE B2" },
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(`${year + 1}-02-10T00:00:00Z`),
      timezone: "UTC",
      title: "DELE B2",
      userId: user.id,
    });

    const [context] = await Promise.all([
      browser.newContext({ storageState: user.storageState, timezoneId: "UTC" }),
      planFixture({ goalId: goal.id }),
    ]);

    const page = await context.newPage();
    await page.goto("/exam");

    const card = page.getByText(`No exam date in February ${year + 1}`, { exact: true });
    await expect(card).toBeVisible();
    await expect(page.getByText(/unless you switch to one of the closest/u)).toBeVisible();

    await expect(
      page.getByRole("button", { name: `Use ${longDate(days[0] ?? "")}` }),
    ).toBeVisible();

    // Her own date stays until she picks one.
    await expect.poll(() => readTargetDate(goal.id)).toBe(`${year + 1}-02-10`);

    await page.getByRole("button", { name: `Use ${longDate(days[1] ?? "")}` }).click();

    await expect(card).toBeHidden();
    await expect.poll(() => readTargetDate(goal.id)).toBe(days[1]);

    await context.close();
  });

  test("the plan editor changes the exam's full date any time, with the notice's day one tap away", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Her plan counts down to a day of her own, a week after the notice's.
      const noticeDay = isoDaysFromNow(70);
      const ownDay = isoDaysFromNow(77);
      const laterDay = isoDaysFromNow(84);
      const blueprint = await noticeFixture(noticeDay);
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = isJsonObject(goal.details) ? goal.details : {};

      await prisma.goal.update({
        data: {
          details: { ...details, examYear: Number(noticeDay.slice(0, 4)) },
          examBlueprintId: blueprint.id,
          targetDate: new Date(`${ownDay}T00:00:00Z`),
        },
        where: { id: user.goalId },
      });

      // Her date is one of her plan's settings beside it: a tap opens the editor at it.
      await page.goto("/plan");

      await page
        .getByRole("region", { exact: true, name: "Your plan" })
        .getByRole("button", { name: /^Exam date/u })
        .click();

      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const date = editor.getByLabel("Exam date");
      const offerText = `The exam notice says ${longDate(noticeDay)}.`;
      const offer = editor.getByText(offerText, { exact: true });

      await expect(date).toHaveValue(ownDay);
      await expect(offer).toBeVisible();

      // One tap takes the notice's day. Saving a date plans again, and the offer goes with the new
      // plan, after the date is saved (see `plan-timeouts.ts`).
      await editor.getByRole("button", { name: "Use this date" }).click();
      await expect(offer).toBeHidden({ timeout: REPLAN_TIMEOUT_MS });
      await expect(date).toHaveValue(noticeDay);
      await expect.poll(() => readTargetDate(user.goalId)).toBe(noticeDay);

      // Any full date of her own, saved when she says so; the notice's day is offered again.
      await date.fill(laterDay);
      await editor.getByRole("button", { name: "Save" }).click();
      await expect(offer).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
      await expect(editor.getByRole("button", { name: "Save" })).toBeHidden();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(laterDay);
    });
  });

  test("the Plan says the month the learner named, never a day in it", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // She said a month about two months away; the notice sets the exam weeks before it.
      const noticeDay = isoDaysFromNow(20);
      const named = new Date(Date.now() + 60 * MS_PER_DAY);
      const monthStart = new Date(Date.UTC(named.getUTCFullYear(), named.getUTCMonth(), 1));
      const blueprint = await noticeFixture(noticeDay);
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = isJsonObject(goal.details) ? goal.details : {};

      await prisma.goal.update({
        data: {
          details: {
            ...details,
            examMonth: monthStart.getUTCMonth() + 1,
            examYear: monthStart.getUTCFullYear(),
          },
          examBlueprintId: blueprint.id,
          targetDate: monthStart,
        },
        where: { id: user.goalId },
      });

      const month = new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      }).format(monthStart);

      // The Plan writes a date it knows only to the month as "~Dec", heard "About Dec".
      const shortMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
        monthStart,
      );

      await page.goto("/plan");

      // Her month as her exam's date, among her plan's settings and at the end of her path, and
      // the days left to it as about that many.
      const examDate = page
        .getByRole("region", { exact: true, name: "Your plan" })
        .getByRole("button", { name: `Exam date About ${shortMonth}` });

      await expect(examDate).toBeVisible();

      await expect(
        page
          .getByRole("region", { name: "Next on your path" })
          .getByRole("link", { name: `${goal.title} About ${shortMonth}` }),
      ).toBeVisible();

      await expect(
        page.getByText(new RegExp(`^${goal.title} · ~[\\d,]+ days left`, "u")),
      ).toBeVisible();

      await expect(page.getByText(/About \w+ 1\b/u)).toHaveCount(0);

      // The plan editor, opened at her date, keeps it a month too: no day she never chose in the
      // date field.
      await examDate.click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const date = editor.getByLabel("Exam date");

      await expect(date).toHaveValue("");

      await expect(date).toHaveAccessibleDescription(
        `${month} for now. Pick the day when you know it.`,
      );
    });
  });

  test("the time step says the month the learner named", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);

    await prisma.goal.update({
      data: {
        details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
        targetDate: new Date("2099-12-01T00:00:00Z"),
      },
      where: { id: goal.id },
    });

    // Main's E2E runs without the API: what the time picked covers, for a plan counting down to
    // December 2099, and the time Find finds when the learner asks.
    await page.route(`**/v1/goals/${goal.id}/plan/time-advice**`, (route) =>
      route.fulfill({
        json: {
          coveredShare: null,
          measure: "goal",
          numbers: null,
          ready: true,
          targetDate: "2099-12-01",
          targetDateNamedMonth: true,
        },
      }),
    );

    await routeTimeToCover(page, {
      goalId: goal.id,
      time: { recommendedMinutes: 60, targetDate: "2099-12-01", targetDateNamedMonth: true },
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { name: "Skip and start from the basics" }).click();
    await page.getByRole("button", { name: "Find the time that covers everything" }).click();

    await expect(
      page.getByText("1 hr a day covers everything in depth by December 2099."),
    ).toBeVisible();
  });
});
