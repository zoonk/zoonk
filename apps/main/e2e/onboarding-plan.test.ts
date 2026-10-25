import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";
import { routeTimeToCover } from "./time-to-cover-routes";

/**
 * The end of onboarding: placement while the plan is being made, then the plan. The goal is one
 * whose skill map is already written, the way the goal workflow leaves it.
 */

/** A moment this many minutes from now (before it, when negative). */
function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/** Placement asks up to this many questions a day (`DAY_PLACEMENT_ANSWERS` in core). */
const DAY_PLACEMENT_ANSWERS = 12;

test.describe("Placement and the plan", () => {
  test("placement adapts to answers, survives a refresh and a new tab, welcomes 'I don't know yet' and ends with the plan, by keyboard", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);
    await page.goto(`/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeVisible();

    // The bar's "More" holds finishing later and starting over.
    const more = page.getByRole("button", { name: "More" });
    await expect(more).toBeVisible();

    await tabTo(page, page.getByRole("button", { exact: true, name: "Start" }));
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
    // What it's about and its number: no total and no score.
    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Algebra", { exact: true })).toBeVisible();
    // An answer is final, so a question has no way back to the screens before placement, and no
    // "More", whose Start over reads over a question as starting the test over.
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
    await expect(more).toHaveCount(0);
    // The bar shows how far along today's few minutes of questions are, from empty.
    const progress = page.getByRole("progressbar", { name: "Questions answered" });
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await expectAccessibleScreen(page, "a placement question");
    const first = await page.getByRole("heading", { name: /^Question/u }).textContent();
    // An option's keycap shows the key that picks it.
    const firstOption = page.getByRole("radio").first();
    await expect(firstOption).toHaveAttribute("aria-keyshortcuts", "1");
    await expect(firstOption.locator("[data-slot='kbd']")).toHaveText("1");
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^Question/u })).not.toHaveText(first ?? "");
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
    await expect(progress).not.toHaveAttribute("aria-valuenow", "0");

    // A refresh comes back to placement's next question instead of its start.
    await page.reload();
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeHidden();

    // So does another tab, which never saw the tap on Start: the answers are what's saved.
    const otherTab = await page.context().newPage();
    await otherTab.goto(`/start/${goal.id}`);
    await expect(otherTab.getByText("Question 2", { exact: true })).toBeVisible();
    await otherTab.close();

    await page.getByRole("button", { name: "I don't know yet" }).click();

    // The answer saves before the next question takes input: a keyboard learner tabs once it can.
    const stop = page.getByRole("button", { name: "Stop here and see my plan" });
    await expect(page.getByText("Question 3", { exact: true })).toBeVisible();
    await expect(stop).toBeEnabled();
    await tabTo(page, stop);
    await page.keyboard.press("Enter");

    // The plan as data: the goal as the title, its facts in one line and its phases on a bar,
    // with Adjust and one way on.
    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(goal.title);
    await expect(page.getByText("30 min a day", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Adjust" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/today");

    // Two phases, the first one current: its band is the step the learner is on.
    const path = page.getByRole("region", { name: "Phases" }).getByRole("list");
    await expect(path.getByRole("listitem")).toHaveCount(2);

    await expect(path.getByRole("listitem").first().locator('[aria-current="step"]')).toContainText(
      ", you are here",
    );

    // No chapters, tools or numbers to read before starting, and never a skill's raw name.
    await expect(page.getByText(/~0 (?:hr|min)\b/u)).toHaveCount(0);
    await expect(page.getByText("Lesson 1", { exact: true })).toHaveCount(0);
    await expect(path.getByRole("button")).toHaveCount(0);

    await expectAccessibleScreen(page, "the plan reveal");

    const [attempts, saved] = await Promise.all([
      prisma.attempt.count({ where: { itemId: { not: null }, userId: noProgressUser.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });
});

test("the plan right after the learner's time shows that time, never the plan the page opened with", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  // Placement and the time are left; the plan was built at the goal's first 30 minutes a day.
  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("1 hr", { exact: true })
    .click();

  // From here on, any moment the page says the old 30 minutes a day is remembered.
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (/30\smin a day/u.test(document.body.innerText)) {
        Object.assign(globalThis, { staleSeen: true });
      }
    }).observe(document.body, { characterData: true, childList: true, subtree: true });
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  await expect(page.getByText("1 hr a day", { exact: true })).toBeVisible();

  await expect(page.evaluate(() => Reflect.get(globalThis, "staleSeen") === true)).resolves.toBe(
    false,
  );
});

// A pick moves on by itself after a moment: Continue in that moment, or another pick while the
// answer saved, used to save it twice and skip the question after it.
test("a picked answer saves once and moves on once, whatever else is pressed while it saves", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await goalFixture({
    details: { answered: ["targetDate", "schedule", "buddy"], subject: "algebra" },
    prompt: `learn algebra ${randomUUID().slice(0, 8)}`,
    title: "Learn algebra",
    userId: noProgressUser.id,
  });

  const purposeSaves: string[] = [];

  // The save takes longer than the pick's moment.
  await page.route(`**/start/${goal.id}`, async (route) => {
    const request = route.request();

    if (request.method() === "POST" && request.postData()?.includes('"purpose"')) {
      purposeSaves.push(request.url());

      await new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });
    }

    await route.continue();
  });

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

  const purposeSaved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      Boolean(response.request().postData()?.includes('"purpose"')),
  );

  await page.getByRole("main").getByText("Use it at work", { exact: true }).click();
  await page.keyboard.press("Enter");
  await page.getByText("Get an overview", { exact: true }).click();

  // Screen readers hear the answer it moved on with, once.
  await expect(page.getByRole("status").filter({ hasText: /^You picked/u })).toHaveText(
    "You picked Use it at work",
  );

  const saveResponse = await purposeSaved;
  expect(saveResponse.status()).toBe(200);

  // Work plans ask the learner's role next: the question after it isn't skipped.
  await expect(page.getByRole("heading", { name: "What do you do at work?" })).toBeVisible();
  expect(purposeSaves).toHaveLength(1);

  await expect
    .poll(async () => {
      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      return saved.details;
    })
    .toMatchObject({ purpose: "work" });

  await expect(page.getByRole("heading", { name: "What do you do at work?" })).toBeVisible();
  expect(purposeSaves).toHaveLength(1);
});

// An IELTS learner's time was lost when saving it crashed and "Try again" started the step over.
test("keeps the learner's time when saving it fails, and saves it on the next try", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("45 min", { exact: true })
    .click();

  // The first save of the time doesn't reach the server.
  let failSave = true;

  await page.route(`**/start/${goal.id}`, async (route) => {
    const request = route.request();
    const savesTime = request.method() === "POST" && request.postData()?.includes('"schedule"');

    if (savesTime && failSave) {
      failSave = false;
      await route.abort();
      return;
    }

    await route.continue();
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "We couldn't save that." })).toBeVisible();
  await expect(page.getByRole("radio", { name: "45 min" })).toBeChecked();

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  await expect(page.getByText("45 min a day", { exact: true })).toBeVisible();
});

test("while the learner changes the days, Find says only the time those days need, and drops an answer for days no longer shown", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  const targetDate = inMinutes(60 * 24 * 90);
  const isoDate = targetDate.toISOString().slice(0, "YYYY-MM-DD".length);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
      targetDate,
    },
    where: { id: goal.id },
  });

  await page.route(`**/v1/goals/${goal.id}/plan/time-advice**`, (route) =>
    route.fulfill({
      json: {
        coveredShare: null,
        measure: "goal",
        numbers: null,
        ready: true,
        targetDate: isoDate,
        targetDateNamedMonth: false,
      },
    }),
  );

  // What Find finds for each number of study days, as Marcos's plan gave it: an hour on every
  // day, 1 hr 10 min on six, 1 hr 25 min on five. Main's E2E runs without the API, so it's stood
  // in for here; while `holding`, answers wait until released, as a big plan's search takes seconds.
  const minutesFor = new Map([
    [5, 85],
    [6, 70],
    [7, 60],
  ]);

  const held: (() => void)[] = [];
  let holding = false;

  await routeTimeToCover(page, {
    goalId: goal.id,
    time: async ({ studyDays = [] }) => {
      if (holding) {
        await new Promise<void>((release) => {
          held.push(release);
        });
      }

      return {
        measure: "goal",
        recommendedMinutes: minutesFor.get(studyDays.length) ?? null,
        targetDate: isoDate,
      };
    },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  const find = page.getByRole("button", { name: "Find the time that covers everything" });
  const covers = page.getByText("Covers everything", { exact: true });

  // The week starts Monday to Friday.
  await find.click();

  await expect(
    page.getByText(/^1\shr 25\smin a day covers everything in depth by /u),
  ).toBeVisible();

  await expect(
    page.getByRole("radio", { name: /^1 hr 25 min\s*Covers everything$/u }),
  ).toBeVisible();

  // Five days' time isn't what six days need: the answer goes with the days it was found for.
  await page.getByRole("button", { name: /^Which days\?/u }).click();
  await page.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByText(/^6 days · /u)).toBeVisible();
  await expect(covers).toHaveCount(0);

  // Back to the five days it was found for, its answer shows again.
  await page.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByText(/^5 days · /u)).toBeVisible();

  await expect(
    page.getByRole("radio", { name: /^1 hr 25 min\s*Covers everything$/u }),
  ).toBeVisible();

  await expect(find).toHaveCount(0);
  await page.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByText(/^6 days · /u)).toBeVisible();

  // A search for six days that's still running when the days change again shows nowhere.
  holding = true;
  await find.click();
  await expect.poll(() => held.length).toBe(1);
  await page.getByRole("button", { name: "Sunday" }).click();
  await expect(page.getByText(/^7 days · /u)).toBeVisible();
  await find.click();
  await expect.poll(() => held.length).toBe(2);

  holding = false;
  held.forEach((release) => release());

  await expect(page.getByText(/^1\shr a day covers everything in depth by /u)).toBeVisible();
  await expect(page.getByText(/^1\shr 10\smin a day covers/u)).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /^1 hr\s*Covers everything$/u })).toBeVisible();

  // Nor when the days go back to the six it was asked for: the newer search replaced it.
  await page.getByRole("button", { name: "Sunday" }).click();
  await expect(page.getByText(/^6 days · /u)).toBeVisible();
  await expect(page.getByText(/^1\shr 10\smin a day covers/u)).toHaveCount(0);
  await expect(covers).toHaveCount(0);
  await expect(find).toBeVisible();

  // A search for six days that's still running while the days change and come back, with no other
  // search, answers the six days she's back at.
  holding = true;
  await find.click();
  await expect.poll(() => held.length).toBe(3);
  await page.getByRole("button", { name: "Sunday" }).click();
  await expect(page.getByText(/^7 days · /u)).toBeVisible();
  await page.getByRole("button", { name: "Sunday" }).click();
  await expect(page.getByText(/^6 days · /u)).toBeVisible();

  const answered = page.waitForResponse((reply) => reply.url().includes("/plan/time-to-cover"));
  holding = false;
  held.at(-1)?.();
  await answered;

  // Once the page took the answer in.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve());
      }),
  );

  await expect(
    page.getByText(/^1\shr 10\smin a day covers everything in depth by /u),
  ).toBeVisible();

  await expect(
    page.getByRole("radio", { name: /^1 hr 10 min\s*Covers everything$/u }),
  ).toBeVisible();

  await expect(find).toHaveCount(0);
});

/** A goal at its time question, with a date 180 days away. */
async function createTimeStepGoal(userId: string) {
  const goal = await createMappedGoal(userId);
  const targetDate = inMinutes(60 * 24 * 180);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
      targetDate,
    },
    where: { id: goal.id },
  });

  return { goal, isoDate: targetDate.toISOString().slice(0, "YYYY-MM-DD".length) };
}

/**
 * What an exam's time covers on Sundays alone, as the real fourteen-lesson, 69-minute-mock planner
 * has it: under 65 minutes topics are left out and 65 fits, but adding a mock at higher budgets
 * makes 90 cover only 12 lessons. Any other week covers everything.
 */
function readSundayExamShare({
  dailyMinutes,
  studyDays,
}: {
  dailyMinutes: number;
  studyDays: string;
}) {
  if (studyDays !== "0") {
    return 1;
  }

  if (dailyMinutes === 90) {
    return 12 / 14;
  }

  return dailyMinutes < 65 ? 0.5 : 1;
}

test("the time step asks what a larger Sunday exam budget covers instead of assuming it fits", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });

  const requests: { dailyMinutes: number; studyDays: string }[] = [];

  // Main runs without the API (see `readSundayExamShare`).
  await page.route(`**/v1/goals/${goal.id}/plan/time-advice**`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const dailyMinutes = Number(params.get("dailyMinutes"));
    const studyDays = params.get("studyDays") ?? "";
    requests.push({ dailyMinutes, studyDays });

    return route.fulfill({
      json: {
        coveredShare: readSundayExamShare({ dailyMinutes, studyDays }),
        measure: "exam",
        numbers: null,
        readingNotice: false,
        ready: true,
        targetDate: isoDate,
        targetDateNamedMonth: false,
      },
    });
  });

  await routeTimeToCover(page, {
    goalId: goal.id,
    time: ({ studyDays = [] }) => ({
      recommendedMinutes: studyDays.join(",") === "0" ? 65 : 60,
      targetDate: isoDate,
    }),
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();
  await page.getByRole("button", { name: /^Which days\?/u }).click();

  // From Monday to Friday to Sunday alone.
  await page.getByRole("button", { exact: true, name: "Sunday" }).click();
  await page.getByRole("button", { exact: true, name: "Monday" }).click();
  await page.getByRole("button", { exact: true, name: "Tuesday" }).click();
  await page.getByRole("button", { exact: true, name: "Wednesday" }).click();
  await page.getByRole("button", { exact: true, name: "Thursday" }).click();
  await page.getByRole("button", { exact: true, name: "Friday" }).click();

  // Half an hour on Sundays leaves topics out, so Find is there to say what covers them all.
  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("30 min", { exact: true })
    .click();

  // The time Find finds is marked, never picked for the learner: they pick it.
  await page.getByRole("button", { name: "Find the time that covers everything" }).click();
  await expect(page.getByText(/^1\shr 5\smin a day covers everything in depth by /u)).toBeVisible();
  const found = page.getByRole("radio", { name: /^1 hr 5 min\s*Covers everything$/u });
  await expect(found).not.toBeChecked();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("1 hr 5 min", { exact: true })
    .click();

  // The answer already planned that time: the estimate says all of it without asking again.
  await expect(found).toBeChecked();
  const estimate = page.getByRole("region", { name: "Estimate" });
  await expect(estimate.getByText(/^100% of the plan's exam topics/u)).toBeVisible();
  expect(requests).not.toContainEqual({ dailyMinutes: 65, studyDays: "0" });

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("1 hr 30 min", { exact: true })
    .click();

  // A found time must not stop asking about this different pick.
  await expect.poll(() => requests).toContainEqual({ dailyMinutes: 90, studyDays: "0" });
  await expect(estimate.getByText(/^~86% of the plan's exam topics/u)).toBeVisible();
  await expect(estimate.getByText(/^100% of the plan's exam topics/u)).toHaveCount(0);
  await expect(page.getByRole("radio", { exact: true, name: "1 hr 30 min" })).toBeChecked();
  await expect(page.getByText(/^1\shr 5\smin a day covers everything in depth by /u)).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("1 hr 5 min", { exact: true })
    .click();

  await expect(estimate.getByText(/^100% of the plan's exam topics/u)).toBeVisible();
});

/**
 * The time step's estimate for a goal at its time question (see `createTimeStepGoal`): from 2
 * hours a day the plan covers everything, under it `short` of it. Asked about studying everything,
 * it ends on `fullCourseEndDate`. The times in `unreadable` can't be worked out. Main runs without
 * the API.
 */
async function routeTwoHourAdvice(
  page: Page,
  {
    fullCourseEndDate = null,
    goalId,
    isoDate,
    measure,
    short,
    unreadable = [],
  }: {
    fullCourseEndDate?: string | null;
    goalId: string;
    isoDate: string;
    measure: "exam" | "goal";
    short: number;
    unreadable?: number[];
  },
) {
  await page.route(`**/v1/goals/${goalId}/plan/time-advice**`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const dailyMinutes = Number(params.get("dailyMinutes"));

    if (unreadable.includes(dailyMinutes)) {
      return route.fulfill({ body: "", status: 500 });
    }

    return route.fulfill({
      json: {
        coveredShare: dailyMinutes >= 120 ? 1 : short,
        fullCourseEndDate: params.get("fullCourse") === "true" ? fullCourseEndDate : null,
        measure,
        numbers: null,
        readingNotice: false,
        ready: true,
        targetDate: isoDate,
        targetDateNamedMonth: false,
      },
    });
  });
}

/** The time step's answer, once Continue sends it. */
function waitForScheduleAnswer(page: Page, goalId: string) {
  return page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith(`/start/${goalId}`) &&
      (request.postData()?.includes('"schedule"') ?? false),
  );
}

test("an exam's time step offers what covers everything only while the time picked leaves something out", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
  await routeTwoHourAdvice(page, { goalId: goal.id, isoDate, measure: "exam", short: 0.5 });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  const minutes = page.getByRole("radiogroup", { name: "Minutes a day" });
  const estimate = page.getByRole("region", { name: "Estimate" });
  const find = page.getByRole("button", { name: "Find the time that covers everything" });
  const everything = page.getByRole("switch", { name: "Study everything, even after the exam" });

  // Half an hour leaves topics out: the estimate says how much it covers, and under it are the
  // two ways to everything, more time or going on after the exam.
  await minutes.getByText("30 min", { exact: true }).click();
  await expect(estimate.getByText(/^~50% of the plan's exam topics/u)).toBeVisible();
  await expect(find).toBeVisible();
  await everything.click();
  await expect(everything).toBeChecked();

  // A time the presets don't have joins them, picked. It covers everything, so nothing else
  // says so again, and there's nothing to go on with after the exam.
  const other = page.getByRole("combobox", { name: "Other time a day" });
  await other.selectOption("150");
  await expect(minutes.getByRole("radio", { exact: true, name: "2 hr 30 min" })).toBeChecked();
  await expect(other).toHaveValue("150");
  await expect(estimate.getByText(/^100% of the plan's exam topics/u)).toBeVisible();
  await expect(find).toHaveCount(0);
  await expect(everything).toHaveCount(0);

  // The switch she can't see isn't her choice: the plan ends at the exam.
  const answer = waitForScheduleAnswer(page, goal.id);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  const sent = await answer;
  const body = sent.postData() ?? "";
  expect(body).toContain('"dailyMinutes":150');
  expect(body).toContain('"fullCourse":false');
});

test("when no time covers an exam by its date, Find hands the keyboard to studying everything after it, which says when it ends and keeps her choice", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });

  await routeTwoHourAdvice(page, {
    fullCourseEndDate: inMinutes(60 * 24 * 400)
      .toISOString()
      .slice(0, "YYYY-MM-DD".length),
    goalId: goal.id,
    isoDate,
    measure: "exam",
    short: 0.5,
    unreadable: [45],
  });

  await routeTimeToCover(page, { goalId: goal.id, time: { targetDate: isoDate } });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("30 min", { exact: true })
    .click();

  await page.getByRole("button", { name: "Find the time that covers everything" }).click();

  const everything = page.getByRole("switch", { name: "Study everything, even after the exam" });
  await expect(everything).toBeFocused();

  await expect(everything).toHaveAccessibleDescription(
    "Until the exam, what comes up most comes first. What doesn't fit comes after it.",
  );

  // On, the plan she'd get is the one asked about: it says when everything ends.
  await page.keyboard.press("Space");
  await expect(everything).toBeChecked();

  await expect(everything).toHaveAccessibleDescription(
    /^At 30\smin a day, you finish in .+, after the exam on .+\. Until the exam, what comes up most comes first\.$/u,
  );

  // Another time whose estimate can't be worked out doesn't take her choice away.
  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("45 min", { exact: true })
    .click();

  const estimate = page.getByRole("region", { name: "Estimate" });

  await expect(
    estimate.getByText(/^We couldn't work out what 45\smin a day covers\./u),
  ).toBeVisible({ timeout: 15_000 });

  await expect(everything).toBeChecked();

  await expect(everything).toHaveAccessibleDescription(
    "Until the exam, what comes up most comes first. What doesn't fit comes after it.",
  );

  const answer = waitForScheduleAnswer(page, goal.id);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  const sent = await answer;
  expect(sent.postData()).toContain('"dailyMinutes":45');
  expect(sent.postData()).toContain('"fullCourse":true');
});

test("when no time covers an exam by its date, Find offers the time that studies every topic, one tap away", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
  await routeTwoHourAdvice(page, { goalId: goal.id, isoDate, measure: "exam", short: 0.5 });

  await routeTimeToCover(page, {
    goalId: goal.id,
    time: { coreMinutes: 390, targetDate: isoDate },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Start from zero" }).click();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("30 min", { exact: true })
    .click();

  await page.getByRole("button", { name: "Find the time that covers everything" }).click();

  await expect(
    page.getByText("6 hr 30 min a day studies every topic, some in less depth."),
  ).toBeVisible();

  // The time joins the chips, marked and focused, not picked: Space picks it.
  const chip = page.getByRole("radio", { name: /^6 hr 30 min\s*Every topic$/u });
  await expect(chip).toBeFocused();
  await expect(chip).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(chip).toBeChecked();
});

test("a goal's time step says the next screen moves its date only while the time leaves something out", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  await routeTwoHourAdvice(page, { goalId: goal.id, isoDate, measure: "goal", short: 0.4 });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  const minutes = page.getByRole("radiogroup", { name: "Minutes a day" });
  const estimate = page.getByRole("region", { name: "Estimate" });
  const find = page.getByRole("button", { name: "Find the time that covers everything" });

  const moveDate = page.getByText(
    /^To cover everything at 30\smin a day, move your date on the next screen\.$/u,
  );

  await minutes.getByText("30 min", { exact: true }).click();
  await expect(estimate.getByText(/^~40% of your goal in depth by /u)).toBeVisible();
  await expect(find).toBeVisible();
  await expect(moveDate).toBeVisible();
  await expect(page.getByRole("switch", { name: /Study everything/u })).toHaveCount(0);

  await minutes.getByText("2 hr", { exact: true }).click();
  await expect(estimate.getByText(/^100% of your goal in depth by /u)).toBeVisible();
  await expect(find).toHaveCount(0);
  await expect(page.getByText(/move your date on the next screen/u)).toHaveCount(0);
});

test("the time step keeps asking while a slow plan is still being built, and finds its time once it's ready", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);

  // Main's E2E runs without the API: the plan is still being built until `built`, as Carla's was
  // for over four minutes while five other learners started at the same time.
  let built = false;
  let asked = 0;

  await page.route(`**/v1/goals/${goal.id}/plan/time-advice**`, (route) => {
    asked += 1;

    return route.fulfill({
      json: {
        coveredShare: built ? 0.6 : null,
        measure: "goal",
        numbers: null,
        ready: built,
        targetDate: built ? isoDate : null,
        targetDateNamedMonth: false,
      },
    });
  });

  await routeTimeToCover(page, {
    goalId: goal.id,
    time: { recommendedMinutes: 100, targetDate: isoDate },
  });

  await page.clock.install();
  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  const building = page.getByText("Building your plan…");
  const find = page.getByRole("button", { name: "Find the time that covers everything" });
  await expect(building).toBeVisible();
  await expect(find).toHaveCount(0);

  // Past the few minutes a plan usually takes, it still asks, and still says it's being built.
  const askedBefore = asked;
  await page.clock.setSystemTime(Date.now() + 4 * 60 * 1000);
  await expect.poll(() => asked).toBeGreaterThan(askedBefore);
  await expect(building).toBeVisible();
  await expect(page.getByText("You can change this anytime.")).toHaveCount(0);

  // The plan is built: Find comes, and finds its time when the learner asks.
  built = true;
  await find.click();

  await expect(
    page.getByText(/^1\shr 40\smin a day covers everything in depth by /u),
  ).toBeVisible();

  await expect(
    page.getByRole("radio", { name: /^1 hr 40 min\s*Covers everything$/u }),
  ).toBeVisible();
});

test("when the time can't be worked out, the time step says so and asks again on Try again", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal, isoDate } = await createTimeStepGoal(noProgressUser.id);
  let failing = true;

  await page.route(`**/v1/goals/${goal.id}/plan/time-advice**`, (route) =>
    failing
      ? route.fulfill({ body: "", status: 500 })
      : route.fulfill({
          json: {
            coveredShare: 0.6,
            measure: "goal",
            numbers: null,
            ready: true,
            targetDate: isoDate,
            targetDateNamedMonth: false,
          },
        }),
  );

  let findFails = true;

  await page.route(`**/v1/goals/${goal.id}/plan/time-to-cover`, (route) =>
    findFails
      ? route.fulfill({ body: "", status: 500 })
      : route.fulfill({
          json: {
            coreMinutes: null,
            fittingDate: null,
            readingNotice: false,
            ready: true,
            recommendedMinutes: 60,
            targetDate: isoDate,
            targetDateNamedMonth: false,
          },
        }),
  );

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  // After three tries, three seconds apart, the estimate says so: never a quiet fallback that reads
  // as if there were nothing to cover.
  const estimate = page.getByRole("region", { name: "Estimate" });

  await expect(estimate.getByText(/^We couldn't work out what .+ a day covers\./u)).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.getByText("You can change this anytime.")).toHaveCount(0);

  failing = false;
  await estimate.getByRole("button", { name: "Try again" }).click();
  await expect(estimate.getByText(/^~60% of your goal in depth by /u)).toBeVisible();

  // Find says when it couldn't find the time, with Try again in its own place.
  const find = page.getByRole("button", { name: "Find the time that covers everything" });
  await find.click();
  await expect(page.getByText("We couldn't work out the time needed.")).toBeVisible();
  const retry = page.getByRole("button", { exact: true, name: "Try again" });
  await expect(retry).toBeFocused();

  findFails = false;
  await retry.click();
  await expect(page.getByText(/^1\shr a day covers everything in depth by /u)).toBeVisible();

  // The learner can always go on with a time of their own.
  await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
});

test("starting from the plan on a weekday the learner rests opens today's session, with no new-week note", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  // Today reads the learner's day in the goal's time zone, UTC without one.
  const today = getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" });

  // Onboarding is done but for the plan, which starts today: a weekday the learner rests.
  const weekdayMinutes = Array.from({ length: 7 }, (_, weekday) =>
    weekday === today.getUTCDay() ? 0 : 30,
  );

  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    prisma.plan.update({
      data: { settings: { startDate: today.toISOString().slice(0, 10), weekdayMinutes } },
      where: { goalId: goal.id },
    }),
  ]);

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  // The plan is built from the answers: changing them is in "Adjust", not back through them.
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);

  await page.getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  const card = page.getByRole("region", { name: "Today's session" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "No study planned today" })).toHaveCount(0);
  await expect(page.getByText(/fresh week/u)).toHaveCount(0);
});

test("an exam's plan waits on the reveal while its notice is read, and says when it follows the usual structure", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  // Placement is done; research is still reading the exam's notice.
  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    prisma.plan.update({ data: { noticeWaitUntil: inMinutes(10) }, where: { goalId: goal.id } }),
  ]);

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Reading the exam's official documents" }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Start" })).toHaveCount(0);
  await expectAccessibleScreen(page, "the plan waiting for the exam notice");

  // The reading lands in the plan: the reveal shows it by itself.
  await prisma.plan.update({ data: { noticeWaitUntil: null }, where: { goalId: goal.id } });

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  await expect(page.getByText(/usual structure/u)).toHaveCount(0);

  // Past the wait, the plan shows the exam's usual structure and says what happens next.
  await prisma.plan.update({
    data: { noticeWaitUntil: inMinutes(-1) },
    where: { goalId: goal.id },
  });

  await page.reload();

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  await expect(
    page.getByText(
      "This plan follows the exam's usual structure while we finish reading its official documents. If they change your plan, you'll decide on Today.",
    ),
  ).toBeVisible();
});

/** The day this many days from now, as an ISO date. */
function isoDaysFromNow(days: number): string {
  return inMinutes(60 * 24 * days)
    .toISOString()
    .slice(0, "YYYY-MM-DD".length);
}

/** Taking the notice day answers the same advice on Today, with or without a saved graph. */
async function expectNoticeDayTaken({
  hasGraph,
  page,
  userId,
}: {
  hasGraph: boolean;
  page: Page;
  userId: string;
}) {
  const goal = await createMappedGoal(userId);
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
  const noticeDay = isoDaysFromNow(90);

  if (hasGraph) {
    const items = await prisma.planItem.findMany({
      include: { skill: true },
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ name: "Stage 1" }, { name: "Stage 2" }],
          skills: items.flatMap((item) =>
            item.skill
              ? [
                  {
                    area: null,
                    lessons: 1,
                    name: item.skill.name,
                    phase: item.phase,
                    skillId: item.skill.id,
                    weight: null,
                  },
                ]
              : [],
          ),
        },
      },
      where: { id: plan.id },
    });
  }

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: [
        {
          citation: { passage: "", sourceId: "notice" },
          date: noticeDay,
          kind: "exam",
          label: "Exam",
          startTime: null,
        },
      ],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year: Number(noticeDay.slice(0, 4)),
    },
  });

  // Her plan counts down to a day of her own; Today would ask about the notice's day too.
  const [, proposal] = await Promise.all([
    prisma.goal.update({
      data: {
        details: {
          answered: [...ANSWERED, "placement"],
          examName: "Test Exam",
          subject: "algebra",
        },
        examBlueprintId: blueprint.id,
        kind: "exam",
        targetDate: new Date(`${isoDaysFromNow(120)}T00:00:00Z`),
      },
      where: { id: goal.id },
    }),
    planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
        source: "notice",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    }),
  ]);

  await page.goto(`/start/${goal.id}`);

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  const offer = page.getByText(/^The exam notice says .+\.$/u);
  await expect(offer).toBeVisible();

  await page.getByRole("button", { name: "Use this date" }).click();
  await expect(offer).toBeHidden();

  await expect
    .poll(async () => {
      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      return saved.targetDate?.toISOString().slice(0, 10);
    })
    .toBe(noticeDay);

  await expect(
    prisma.planChange.findUniqueOrThrow({ where: { id: proposal.id } }),
  ).resolves.toMatchObject({ status: "replaced" });

  // Taking it answered Today's question about the same date.
  await page.getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  await expect(page.getByRole("region", { exact: true, name: "Today's session" })).toBeVisible();

  await expect(page.getByRole("region", { name: "Suggested change" })).toHaveCount(0);

  await expect(
    page.getByText("A newer suggestion replaced this one.", { exact: true }),
  ).toHaveCount(0);

  // Coming back to Plan shows the date she took without asking about the same notice again.
  await page.goto("/plan");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Plan" })).toBeVisible();

  await expect(page.getByRole("region", { exact: true, name: "Your plan" })).toBeVisible();
  await expect(page.getByText(/^The exam notice says .+\.$/u)).toHaveCount(0);

  await expect(
    page.getByText("A newer suggestion replaced this one.", { exact: true }),
  ).toHaveCount(0);
}

test("the reveal offers the exam notice's day over the learner's own, and takes it in one tap", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await expectNoticeDayTaken({ hasGraph: false, page, userId: noProgressUser.id });
});

test("the reveal offers the exam notice's day over the learner's own, and takes it in one tap, with its saved skill graph", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await expectNoticeDayTaken({ hasGraph: true, page, userId: noProgressUser.id });
});

// Dele said February; DELE B2 sits in November and April. Nothing told her.
test("the reveal says the learner's month has no exam date, and takes the closest in one tap", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  const year = new Date().getUTCFullYear() + 1;
  const days = [`${year}-11-14`, `${year + 1}-04-02`];
  const citation = { passage: "", sourceId: "notice" };

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam", startTime: null })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year,
    },
  });

  await prisma.goal.update({
    data: {
      details: { answered: [...ANSWERED, "placement"], examName: "DELE B2", subject: "algebra" },
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(`${year + 1}-02-10T00:00:00Z`),
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  const card = page.getByText(`No exam date in February ${year + 1}`, { exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByRole("button", { name: `Use November 14, ${year}` })).toBeVisible();

  await page.getByRole("button", { name: `Use April 2, ${year + 1}` }).click();
  await expect(card).toBeHidden();

  await expect
    .poll(async () => {
      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      return saved.targetDate?.toISOString().slice(0, 10);
    })
    .toBe(days[1]);
});

test("an exam's placement says how many areas it covers, and that there's no score", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID();

  const blueprint = await prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `e2e-exam-${id}`,
      language: "en",
      model: "test",
      name: `Test exam ${id}`,
      promptVersion: "test",
      runId: "test",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: ["Languages", "Humanities", "Science", "Math"].map((name) => ({
          citation: { passage: name, sourceId: id },
          name,
          questions: 45,
          topics: [],
          weight: null,
        })),
      },
    },
  });

  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: [...ANSWERED, "target"], subject: "ENEM" },
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByText(
      "A few quick questions about the 4 areas, so your plan skips what you already know. There's no score, and “I don't know yet” is a fine answer.",
    ),
  ).toBeVisible();

  // The count says enough: the areas live on the exam's page, not in a list here.
  await expect(page.getByText("Humanities", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip and start from the basics" })).toBeVisible();
});

test("an exam with several subjects asks which ones the learner already knows well", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID();
  const constitutional = "Noções de Direito Constitucional e de Regimento Interno";

  const blueprint = await prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `e2e-exam-${id}`,
      language: "en",
      model: "test",
      name: `Test exam ${id}`,
      promptVersion: "test",
      runId: "test",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          { name: "Língua Portuguesa", questions: 30, shortName: null },
          { name: constitutional, questions: 30, shortName: "Direito Constitucional" },
          { name: "Tecnologia da Informação", questions: 30, shortName: null },
          // The notice's written test is listed with its subjects, but it isn't one to know well.
          { name: "Prova discursiva", questions: null, shortName: null },
        ].map((subject) => ({
          ...subject,
          citation: { passage: subject.name, sourceId: id },
          topics: [],
          weight: null,
        })),
      },
    },
  });

  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((question) => question !== "level"), subject: "Câmara" },
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  const question = "Which subjects do you already know well?";
  await expect(page.getByRole("heading", { name: question })).toBeVisible();

  // A long official name shows as learners call it; nothing picked asks the quick test alone.
  await expect(page.getByRole("button", { name: "None of them yet" })).toBeVisible();

  await expect(page.getByRole("checkbox")).toHaveCount(3);
  // Each checkbox goes by its row's words, said once.
  await expect(
    page.getByRole("checkbox", { exact: true, name: "Língua Portuguesa" }),
  ).toBeVisible();

  await expect(page.getByRole("checkbox", { name: "Prova discursiva" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Direito Constitucional" }).click();
  await expectAccessibleScreen(page, question);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Let's see what you already know" }),
  ).toBeVisible();

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
    details: { knownSubjects: [constitutional] },
  });

  // Back shows what the learner picked, to change or keep.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: question })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Direito Constitucional" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Língua Portuguesa" })).not.toBeChecked();
});

test("Back to the level question shows the level the learner picked", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: {
        answered: ANSWERED.filter((question) => question !== "level"),
        subject: "algebra",
      },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  const question = "How much do you already know?";
  await expect(page.getByRole("heading", { name: question })).toBeVisible();
  await page.getByRole("radio", { name: /^I studied it before/u }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Let's see what you already know" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: question })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^I studied it before/u })).toBeChecked();
});

test("after an answer, placement waits for its next questions instead of repeating one", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = `q${randomUUID().slice(0, 8)}`;

  const goal = await goalFixture({
    details: { answered: ANSWERED, subject: "algebra" },
    prompt: `learn algebra ${id}`,
    title: `Learn algebra ${id}`,
    userId: noProgressUser.id,
  });

  const skills = await Promise.all(
    [1, 2, 3].map((index) => skillFixture({ name: `Skill ${index} ${id}` })),
  );

  // The skill map is written, but questions exist only for the middle skill so far.
  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Stage 1" }],
      skills: skills.map((skill) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        phase: 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    itemFixture({ content: choiceItemContent(`First ${id}?`), skillId: skills[1]?.id ?? "" }),
  ]);

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

  await itemFixture({ content: choiceItemContent(`Next ${id}?`), skillId: skills[2]?.id ?? "" });

  await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`Next ${id}`, "u") })).toBeVisible();
});

test.describe("Typed placement answers", () => {
  test("a right pick is confirmed with an answer in the learner's own words", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const id = randomUUID().slice(0, 8);

    const [goal, skill] = await Promise.all([
      goalFixture({
        details: { answered: ANSWERED, subject: "fractions" },
        prompt: `learn fractions ${id}`,
        title: `Learn fractions ${id}`,
        userId: noProgressUser.id,
      }),
      skillFixture({ name: `Adding fractions ${id}` }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Stage 1" }],
        skills: [
          { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
    });

    await Promise.all([
      planItemFixture({
        kind: "lesson",
        phase: 0,
        planId: plan.id,
        position: 0,
        skillId: skill.id,
        titleSnapshot: "Lesson 1",
      }),
      itemFixture({ content: choiceItemContent(`Quick ${id}?`), skillId: skill.id }),
      itemFixture({
        content: {
          acceptedAnswers: ["5/6"],
          context: null,
          keyPoints: ["Adds the fractions as sixths"],
          question: `How much is 1/2 + 1/3? ${id}`,
          sampleAnswer: "3/6 + 2/6 = 5/6",
        },
        format: "typed",
        skillId: skill.id,
      }),
    ]);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");

    // A right pick could be a guess, so the next question asks for the answer in words.
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
    const answer = page.getByLabel("Your answer, in your own words");
    await expect(answer).toBeFocused();
    await answer.fill("5/6");

    // Enter sends it once the question is ready, like Confirm.
    await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled();
    await page.keyboard.press("Enter");

    // Both answers settle the only skill, so placement is done.
    await expect(page.getByRole("heading", { name: "Your starting point is set" })).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();

    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

    await expect(
      prisma.attempt.findFirst({ where: { item: { format: "typed" }, userId: noProgressUser.id } }),
    ).resolves.toMatchObject({ isCorrect: true });
  });

  test("stops after the day's few minutes and leaves the rest to the first sessions", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);

    // The plan's first skill: right answers there leave the skills after it still to ask about.
    const first = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { plan: { goalId: goal.id } },
    });

    const item = await prisma.item.findFirstOrThrow({ where: { skillId: first.skillId ?? "" } });

    // Earlier today, placement already took all but one of the day's answers. "Today" is the
    // learner's day in the browser's time zone, UTC in tests.
    const localDate = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

    await Promise.all(
      Array.from({ length: DAY_PLACEMENT_ANSWERS - 1 }, () =>
        attemptFixture({
          itemId: item.id,
          localDate,
          skillId: item.skillId,
          userId: noProgressUser.id,
        }),
      ),
    );

    // Placement already began for this goal, so coming back opens its next question.
    await page.goto(`/start/${goal.id}`);

    await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeHidden();

    await page.keyboard.press("1");
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { name: "That's enough questions for today" }),
    ).toBeVisible();

    await expect(page.getByText(/Your first sessions ask a few more/u)).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();
    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  });
});
