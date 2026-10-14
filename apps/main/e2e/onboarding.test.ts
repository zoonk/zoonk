import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { normalizeIdentityText } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";

/**
 * Onboarding from a typed goal, as a visitor who becomes a guest. The understanding is stored the
 * way a real one is, as that guest's own (a reading is its learner's), so the flow runs without
 * the AI task. Each screen
 * is scanned for accessibility once, in a flow that shows it; the scans are spread over several
 * flows (onboarding-steps and onboarding-course-start too) so none runs long.
 */

type Understanding = Parameters<typeof goalUnderstandingFixture>[0]["result"];

const GOAL_URL = /\/start\/[0-9a-f-]{36}$/u;

/** A year a plan reaches (at most 3,650 days ahead), for the deadlines the words give. */
const DEADLINE_YEAR = new Date().getUTCFullYear() + 3;

/**
 * Stores what the words mean for the page's guest, as a real read leaves it, and returns the words
 * made unique.
 */
async function storeUnderstanding(
  page: Page,
  { result, words }: { result: Understanding; words: string },
) {
  const goal = `${words} ${randomUUID().slice(0, 8)}`;
  await goalUnderstandingFixture({ goal, result, userId: await ensureGuest(page) });
  return goal;
}

async function openStart(page: Page) {
  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
}

async function sendGoal(page: Page, goal: string) {
  await page.getByRole("textbox", { name: "I want to" }).fill(goal);
  await page.getByRole("button", { name: "Build my plan" }).click();
}

async function typeGoal(page: Page, { result, words }: { result: Understanding; words: string }) {
  const goal = await storeUnderstanding(page, { result, words });
  await openStart(page);
  await sendGoal(page, goal);

  return goal;
}

/** The goal the confirmed words made, once its onboarding opens. */
async function findCreatedGoal(page: Page, goal: string) {
  await expect(page).toHaveURL(GOAL_URL);
  return prisma.goal.findFirstOrThrow({ where: { prompt: goal } });
}

async function confirmGoal(page: Page, goal: string) {
  await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();

  return findCreatedGoal(page, goal);
}

async function continueWith(page: Page, heading: string, choose?: () => Promise<void>) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await choose?.();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
}

/** Scans a question as it looks right before moving on: answered, so Continue is enabled. */
async function expectAccessibleAnswer(page: Page, heading: string) {
  await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
  await expectAccessibleScreen(page, heading);
}

/** Scans the plan being built. */
async function expectAccessiblePlanWait(page: Page) {
  await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
  await expectAccessibleScreen(page, "the plan being built");
}

/** Reaches the control with Tab, as a keyboard-only learner does, and presses it with Enter. */
async function pressByKeyboard(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press("Enter");
}

/**
 * Types the goal and confirms what was understood from the keyboard, scanning the card, and
 * returns the goal it made.
 */
async function startByKeyboard(page: Page, goal: string) {
  await tabTo(page, page.getByRole("textbox", { name: "I want to" }));
  await page.keyboard.type(goal);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
  await expectAccessibleScreen(page, "what was understood");
  await pressByKeyboard(page, page.getByRole("button", { name: "Looks right" }));

  return findCreatedGoal(page, goal);
}

/** Answers a question and continues from the keyboard once Continue is enabled. */
async function answerByKeyboard(
  page: Page,
  { choose, heading }: { choose: () => Promise<void>; heading: string },
) {
  const next = page.getByRole("button", { exact: true, name: "Continue" });

  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await choose();
  await expect(next).toBeEnabled();
  await pressByKeyboard(page, next);
}

const QUANTUM: Understanding = {
  followUps: [],
  goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
  route: "goals",
};

test.describe("Onboarding from a typed goal", () => {
  test("a plan that stops building says so by Continue, without moving the choices", async ({
    browser,
  }) => {
    // AI is off in tests, so the plan the answers start building always stops: the notice arrives
    // while the learner is on a question, on a phone and on a laptop, in either theme.
    for (const { colorScheme, width } of [
      { colorScheme: "light", width: 390 },
      { colorScheme: "dark", width: 390 },
      { colorScheme: "light", width: 1440 },
      { colorScheme: "dark", width: 1440 },
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
      const context = await browser.newContext({ colorScheme, viewport: { height: 900, width } });

      try {
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        const page = await context.newPage();
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        const goal = await typeGoal(page, {
          result: QUANTUM,
          words: "i want to understand quantum physics",
        });
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await confirmGoal(page, goal);
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await expect(
          page.getByRole("heading", { name: "What do you want from it?" }),
        ).toBeVisible();

        const first = page.getByRole("radio").first();
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        const before = await first.boundingBox();

        const stopped = page.getByText(
          /^(?:Building your plan stopped|We couldn't start building your plan)$/u,
        );
        // The run retries before it gives up, longer than an assertion's default wait.
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await expect(stopped).toBeVisible({ timeout: 30_000 });

        // It sits with Continue, in a live region screen readers hear, and the choices stay put.
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await expect(page.locator("[aria-live='polite']").filter({ has: stopped })).toHaveCount(1);
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        expect(await first.boundingBox()).toStrictEqual(before);
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await page.screenshot({
          path: test.info().outputPath(`plan-stopped-${width}-${colorScheme}.png`),
        });
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- One screen at a time.
        await context.close();
      }
    }
  });

  test("a visitor goes from a goal in their words to a plan, by keyboard", async ({ page }) => {
    const goal = await storeUnderstanding(page, {
      result: QUANTUM,
      words: "i want to understand quantum physics",
    });

    await openStart(page);
    const created = await startByKeyboard(page, goal);

    // Number keys pick an answer, as on every list, and Enter continues.
    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();
    await page.keyboard.press("4");
    await expect(page.getByRole("radio", { name: /Change careers/u })).toBeChecked();
    await page.keyboard.press("Enter");

    // A career change is planned around the role they want and what they do now.
    const role = "Where are you headed?";
    await expect(page.getByRole("heading", { name: role })).toBeVisible();
    await page.getByRole("textbox", { name: "The role you want" }).fill("Data analyst");
    await page.getByRole("textbox", { name: "What you do now" }).fill("Teacher");
    await expectAccessibleAnswer(page, role);
    await pressByKeyboard(page, page.getByRole("button", { exact: true, name: "Continue" }));

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await pressByKeyboard(page, page.getByRole("button", { name: "No date" }));

    await answerByKeyboard(page, {
      choose: () => page.getByText("The basics").click(),
      heading: "How much do you already know?",
    });

    // Everyone's first onboarding brings a buddy: one comes picked and its name is optional, so
    // one Continue is enough.
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Zu/u })).toBeChecked();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
    await pressByKeyboard(page, page.getByRole("button", { exact: true, name: "Continue" }));

    // Placement is a step between the questions, with their dots and their count.
    const placement = "Let's see what you already know";
    await expect(page.getByRole("heading", { name: placement })).toBeVisible();
    await expect(page.getByRole("img", { name: "Step 6 of 7" })).toBeVisible();
    await expect(page.getByText(/A few quick questions, so your plan skips/u)).toBeVisible();
    await expectAccessibleScreen(page, placement);
    const scratch = page.getByRole("button", { name: "Start from zero" });
    await pressByKeyboard(page, scratch);

    // A refresh after placement still counts it: the time is the last of the seven steps.
    const time = page.getByRole("heading", { name: "How much time can you study each day?" });
    await expect(time).toBeVisible();
    await page.reload();
    await expect(time).toBeVisible();

    await answerByKeyboard(page, {
      choose: async () => {
        // The time comes after placement. A new career with no date: an hour a day comes picked
        // (a whole field to learn), never claimed as what the goal needs (without a date there's
        // nothing to cover it by); minutes and days are all it asks.
        await expect(page.getByRole("radio", { exact: true, name: "1 hr" })).toBeChecked();
        await expect(page.getByText(/Recommended/u)).toHaveCount(0);
        await expect(page.getByRole("img", { name: "Step 7 of 7" })).toBeVisible();

        await expect(page.getByText("When will you study?")).toBeHidden();
        await page.getByText("30 min", { exact: true }).click();
        // The days and the weekend's time are folded into one row under the time a day; the week
        // starts Monday to Friday, which nobody has to undo.
        await page.getByRole("button", { name: /^Which days\?/u }).click();

        await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        await page.getByRole("button", { name: "Saturday" }).click();
        await expect(page.getByText("6 days · 3 hr a week")).toBeVisible();

        // Saturday can take its own time; the switch shows the choice only once it's on.
        const weekend = page.getByRole("radiogroup", { name: "Minutes on weekends" });
        await expect(weekend).toBeHidden();
        await page.getByRole("switch", { name: "Different time on weekends" }).click();
        await weekend.getByText("1 hr", { exact: true }).click();
        await expect(page.getByText("6 days · 3 hr 30 min a week")).toBeVisible();
        await expectAccessibleAnswer(page, "How much time can you study each day?");
      },
      heading: "How much time can you study each day?",
    });

    // The plan is written in the background; until then the reveal says so instead of a bare spinner.
    await expectAccessiblePlanWait(page);

    const saved = await prisma.goal.findUniqueOrThrow({
      include: { user: true },
      where: { id: created.id },
    });

    expect(saved.user.isAnonymous).toBe(true);
    expect(saved.dailyMinutes).toBe(30);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: created.id } }),
    ).resolves.toMatchObject({ settings: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 60] } });

    expect(saved.details).toMatchObject({
      answered: expect.arrayContaining([
        "purpose",
        "role",
        "targetDate",
        "level",
        "schedule",
        "placement",
      ]),
      level: "basic",
      purpose: "careerChange",
      role: "Teacher",
      targetPosition: "Data analyst",
    });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: saved.userId },
    });

    expect(profile).toMatchObject({
      activeGoalId: created.id,
      buddyKind: "zu",
      memoryEnabled: true,
    });
  });

  test("a new learner names their buddy, starts from nothing and is offered a Library course", async ({
    page,
  }) => {
    const subject = `Tide pools ${randomUUID().slice(0, 8)}`;
    const org = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(subject),
      organizationId: org.id,
      title: subject,
    });

    const goal = await typeGoal(page, {
      result: {
        dailyMinutes: 20,
        followUps: [],
        goals: [
          {
            kind: "learn",
            ownLevel: "none",
            purpose: "overview",
            subject,
            targetDate: `${DEADLINE_YEAR}-01-31`,
            title: `Learn about ${subject}`,
          },
        ],
        route: "goals",
      },
      words: `learn about ${subject} from zero by ${DEADLINE_YEAR}, 20 min a day`,
    });

    await expect(page.getByText("20 min a day")).toBeVisible();
    const created = await confirmGoal(page, goal);

    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await page.getByRole("radio", { name: /Otto/u }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Octavia");
    await expectAccessibleAnswer(page, "Choose your buddy");
    await pressByKeyboard(page, page.getByRole("button", { exact: true, name: "Continue" }));

    // Starting from nothing skips placement: every phase starts at its beginning.
    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();

    // Once the answers are in, a Library course that teaches the goal is offered.
    await expect(
      page.getByRole("link", { name: /A course in the Library fits your goal/u }),
    ).toHaveAttribute("href", `/b/${org.slug}/c/${course.slug}`);

    const profile = await prisma.userLearningProfile.findFirstOrThrow({
      where: { activeGoalId: created.id },
    });

    expect(profile).toMatchObject({ buddyKind: "otto", buddyName: "Octavia" });
  });

  test("an exam card shows one date row with its source, keeps the learner's fixes and asks only what's missing", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const name = `Zoonk test exam ${id}`;
    const title = `Pass the ${name} on the first try`;
    const thisYear = new Date().getUTCFullYear();
    const noticeYear = thisYear + 1;
    const namedYear = thisYear + 3;
    const source = await sourceFixture({ title: `${name} notice` });

    const day = (date: string, label: string) => ({
      citation: { passage: label, sourceId: source.id },
      date,
      kind: "exam",
      label,
      startTime: null,
    });

    await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [day(`${noticeYear}-11-08`, "Day 1"), day(`${noticeYear}-11-15`, "Day 2")],
        noticeUrl: source.url,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: noticeYear,
      },
      identityKey: normalizeIdentityText(name),
      name,
    });

    const goal = await typeGoal(page, {
      result: {
        followUps: [],
        goals: [
          {
            examName: name,
            examYear: namedYear,
            institution: "a federal university",
            kind: "exam",
            subject: name,
            targetCourse: "Nursing",
            targetScore: "An average of about 700",
            title: `Pass the ${name} ${namedYear}`,
          },
        ],
        route: "goals",
        studyTime: "21:30",
        studyTimeNote: "At night, after school",
      },
      words: `pass the ${name} in ${namedYear} for nursing, i study at night`,
    });

    await expect(page.getByText(`Pass the ${name} ${namedYear}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Nursing", { exact: true })).toBeVisible();
    await expect(page.getByText("Where: a federal university")).toBeVisible();
    await expect(page.getByText("An average of about 700")).toBeVisible();
    await expect(page.getByText("At night, after school")).toBeVisible();

    // One date row: no notice for the year they named yet, so its usual days, labeled as an
    // estimate the app will tell them about, and no separate year row.
    await expect(page.getByText("Exam dates", { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`,\\s${namedYear}$`, "u"))).toBeVisible();
    await expect(page.getByText(/We'll tell you when the official ones are out/u)).toBeVisible();
    await expect(page.getByText("Exam year", { exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: /^Source:/u })).toBeHidden();

    // The same row takes any full date of her own: no estimated day is offered over it.
    const ownDay = `${namedYear}-10-20`;
    const ownDate = `October 20, ${namedYear}`;
    await page.getByRole("button", { name: "Edit Exam dates" }).click();
    await page.getByLabel("Exam date").fill(ownDay);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(ownDate, { exact: true })).toBeVisible();
    await expect(page.getByText(/We'll tell you when the official ones are out/u)).toBeHidden();
    await expect(page.getByRole("button", { name: "Use this date" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit Exam date" })).toBeFocused();

    // Fix facts in place: the goal's title and when they study. Each fix is saved on the draft;
    // closing an edit gives focus back to that row's pencil.
    await page.getByRole("button", { name: "Edit Goal" }).click();
    await page.getByRole("textbox", { name: "Goal" }).fill(title);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Goal" })).toBeFocused();

    await page.getByRole("button", { name: "Edit When you study" }).click();
    await page.getByLabel("When you study").fill("20:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("8:00 PM")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit When you study" })).toBeFocused();

    // A refresh keeps what was understood, with the learner's fixes.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
    await expect(page.getByText(goal, { exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(ownDate, { exact: true })).toBeVisible();
    await expect(page.getByText("8:00 PM")).toBeVisible();

    const created = await confirmGoal(page, goal);

    expect(created).toMatchObject({
      details: { examYear: namedYear },
      kind: "exam",
      studyTime: "20:00",
      targetDate: new Date(`${ownDay}T00:00:00.000Z`),
      title,
    });

    expect(created.examBlueprintId).not.toBeNull();

    // The exam is named apart from the question, so no language needs an article for it.
    await expect(page.getByRole("main").getByText(name, { exact: true })).toBeVisible();

    await continueWith(page, "How much do you already know?", () =>
      page.getByText("The basics").click(),
    );

    await continueWith(page, "Choose your buddy");
    await page.getByRole("button", { name: "Start from zero" }).click();

    // The time comes after placement. Minutes and days only; while the plan isn't built yet, a
    // public exam over a year away starts at an hour a day.
    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    await expect(page.getByRole("radio", { exact: true, name: "1 hr" })).toBeChecked();

    await expect(page.getByText("When will you study?")).toBeHidden();
  });

  // Sofia's card said "You said March; the notice sets this date" over the notice's day and let her
  // fix only the year. Her month stays; the notice's day is one tap away, and so is any date.
  test("an exam card keeps the month the learner named, offers the notice's day in one tap and takes any date", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const name = `Zoonk month exam ${id}`;
    const noticeYear = new Date().getUTCFullYear() + 1;
    const source = await sourceFixture({ title: `${name} notice` });

    await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          {
            citation: { passage: "Day 1", sourceId: source.id },
            date: `${noticeYear}-11-08`,
            kind: "exam",
            label: "Day 1",
            startTime: null,
          },
        ],
        noticeUrl: source.url,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: noticeYear,
      },
      identityKey: normalizeIdentityText(name),
      name,
    });

    await typeGoal(page, {
      result: {
        followUps: [],
        goals: [
          {
            examMonth: 3,
            examName: name,
            examYear: noticeYear,
            kind: "exam",
            subject: name,
            title: `Pass the ${name} in March`,
          },
        ],
        route: "goals",
      },
      words: `pass the ${name} in march ${noticeYear}`,
    });

    // The plan counts down to her month; the notice's day is offered, with its source.
    const noticeDay = /^The exam notice says November\s8,\s\d{4}\./u;
    await expect(page.getByText("Exam date", { exact: true })).toBeVisible();
    await expect(page.getByText(`March ${noticeYear}`, { exact: true })).toBeVisible();
    await expect(page.getByText(noticeDay)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Source:/u })).toBeVisible();

    // She sets an exact day of her own: still not the notice's, which stays one tap away.
    await page.getByRole("button", { name: "Edit Exam date" }).click();
    await page.getByLabel("Exam date").fill(`${noticeYear}-03-20`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`March 20, ${noticeYear}`, { exact: true })).toBeVisible();
    await expect(page.getByText(noticeDay)).toBeVisible();

    // One tap takes the notice's day, which then counts down with its source.
    await page.getByRole("button", { name: "Use this date" }).click();
    await expect(page.getByText(`November 8, ${noticeYear}`, { exact: true })).toBeVisible();
    await expect(page.getByText(noticeDay)).toBeHidden();
    await expect(page.getByRole("button", { name: "Use this date" })).toBeHidden();
    await expect(page.getByText(/days? left/u)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Source:/u })).toBeVisible();
  });

  // Dele's DELE B2 without a date listed every sitting and planned for the one six days away, whose
  // registration had closed.
  test("an exam held several times a year asks which date, from the next ones still open", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const name = `Zoonk sittings exam ${id}`;
    const year = new Date().getUTCFullYear() + 1;
    const source = await sourceFixture({ title: `${name} calendar` });
    const citation = { passage: "Calendar", sourceId: source.id };

    const day = (date: string, kind: "exam" | "registrationEnd") => ({
      citation,
      date,
      kind,
      label: kind === "exam" ? "Exam" : "Registration closes",
      startTime: null,
    });

    await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          // March's registration already closed.
          day(`${year - 2}-12-01`, "registrationEnd"),
          day(`${year}-03-06`, "exam"),
          day(`${year}-05-15`, "exam"),
          day(`${year}-07-10`, "exam"),
          day(`${year}-10-09`, "exam"),
        ],
        noticeUrl: source.url,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year,
      },
      identityKey: normalizeIdentityText(name),
      name,
    });

    await typeGoal(page, {
      result: {
        followUps: [],
        goals: [{ examName: name, kind: "exam", subject: name, title: `Pass the ${name}` }],
        route: "goals",
      },
      words: `pass the ${name}`,
    });

    await expect(page.getByText("Pick your date", { exact: true })).toBeVisible();
    await expect(page.getByText(/held several times a year/u)).toBeVisible();
    await expect(page.getByRole("button", { name: `Mar 6, ${year}` })).toBeHidden();
    await expect(page.getByRole("button", { name: `May 15, ${year}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Oct 9, ${year}` })).toBeVisible();

    // One tap makes it her date, with its source and the days left.
    await page.getByRole("button", { name: `Jul 10, ${year}` }).click();
    await expect(page.getByText(`July 10, ${year}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Pick your date", { exact: true })).toBeHidden();
    await expect(page.getByText(/days? left/u)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Source:/u })).toBeVisible();
  });

  test("the card never repeats what the goal's title says, and gives the goal one date", async ({
    page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const examName = `Concurso da Câmara ${id}`;

    await typeGoal(page, {
      result: {
        followUps: [],
        goals: [
          {
            examName,
            examYear: DEADLINE_YEAR,
            institution: "Câmara dos Deputados",
            kind: "exam",
            subject: examName,
            targetDate: `${DEADLINE_YEAR}-01-31`,
            targetPosition: "registro e redação",
            title: `Passar no concurso da Câmara dos Deputados ${id} para registro e redação`,
          },
        ],
        route: "goals",
      },
      words: "passar no concurso da câmara dos deputados para registro e redação",
    });

    await expect(page.getByText("Exam date", { exact: true })).toBeVisible();
    await expect(page.getByText(`January 31, ${DEADLINE_YEAR}`)).toBeVisible();
    await expect(page.getByText("Exam year", { exact: true })).toBeHidden();
    await expect(page.getByText("Where", { exact: true })).toBeHidden();
    await expect(page.getByText("Position", { exact: true })).toBeHidden();
    await expect(page.getByText("registro e redação", { exact: true })).toBeHidden();
  });

  test("a language goal keeps the language, the reason and the level they gave", async ({
    page,
  }) => {
    await typeGoal(page, {
      result: {
        followUps: [],
        goals: [
          {
            kind: "language",
            level: "A2",
            nativeLanguage: "pt",
            ownLevel: "basic",
            reason: "Moving to Toronto, Canada",
            subject: "English",
            targetDate: `${DEADLINE_YEAR}-03-31`,
            targetLanguage: "en",
            title: "Speak English in Toronto",
          },
        ],
        route: "goals",
      },
      words: "i need english, moving to toronto in 6 months, i'm A2",
    });

    await expect(page.getByText("Portuguese")).toBeVisible();
    await expect(page.getByText("Moving to Toronto, Canada")).toBeVisible();
    await expect(page.getByText("you said")).toBeVisible();

    await page.getByRole("button", { name: "Looks right" }).click();

    // Nothing left to ask about the goal: the learner's buddy comes next, the time after placement.
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
  });

  test("an unsafe goal is declined kindly, and a vague one asks for a bit more", async ({
    page,
  }) => {
    const unsafe = await storeUnderstanding(page, {
      result: { route: "unsafe" },
      words: "how to get into someone's account",
    });

    await openStart(page);
    await expectAccessibleScreen(page, "the goal");
    await sendGoal(page, unsafe);

    await expect(page.getByRole("heading", { name: "We can't help with this goal" })).toBeVisible();
    await page.getByRole("button", { name: "Try another goal" }).click();
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();

    // A vague goal isn't guessed at.
    const vague = await storeUnderstanding(page, {
      result: { route: "unclear" },
      words: "be better",
    });

    await sendGoal(page, vague);
    await expect(page.getByRole("heading", { name: "Tell us a bit more" })).toBeVisible();
  });

  test("an instrument joins the waitlist and offers musicianship today", async ({ page }) => {
    await typeGoal(page, {
      result: { instrument: "guitar", route: "instrument" },
      words: "play the guitar",
    });

    await expect(
      page.getByRole("heading", { name: "Lessons for playing guitar are coming" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.getByText("Create an account so we can let you know.")).toBeVisible();

    await page.getByRole("button", { name: "Start musicianship" }).click();
    await expect(page).toHaveURL(GOAL_URL);

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();
  });
});
