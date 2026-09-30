import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * Onboarding from a typed goal, as a visitor who becomes a guest when they submit it. The
 * understanding is stored the way a real one is, so the flow runs without the AI task.
 */

type Understanding = Parameters<typeof goalUnderstandingFixture>[0]["result"];

async function typeGoal(
  page: Page,
  { mode = "focus", result, words }: { mode?: Mode; result: Understanding; words: string },
) {
  const goal = `${words} ${randomUUID().slice(0, 8)}`;
  await goalUnderstandingFixture({ goal, result });
  await setDeviceMode(page.context(), mode);

  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
  await page.getByRole("button", { name: "Start with your goal" }).click();

  return goal;
}

async function confirmGoal(page: Page, goal: string) {
  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  return prisma.goal.findFirstOrThrow({ where: { prompt: goal } });
}

async function continueWith(page: Page, heading: string, choose?: () => Promise<void>) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await choose?.();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
}

async function answerAge(page: Page, year: number) {
  await continueWith(page, "When were you born?", async () => {
    await page.getByLabel("Month").selectOption("3");
    await page.getByLabel("Year").selectOption(String(year));
  });
}

const QUANTUM: Understanding = {
  followUps: [],
  goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
  route: "goals",
};

test.describe("Onboarding from a typed goal", () => {
  test("a visitor goes from a goal in their words to a plan, by keyboard, in Focus", async ({
    page,
  }) => {
    const goal = await typeGoal(page, {
      result: QUANTUM,
      words: "i want to understand quantum physics",
    });

    const created = await confirmGoal(page, goal);

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /Get an overview/u })).toBeChecked();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "No date" }).click();

    await continueWith(page, "How much do you already know?", () =>
      page.getByText("The basics").click(),
    );

    await continueWith(page, "How much time can you study each day?", async () => {
      await page.getByText("30 min", { exact: true }).click();
      await page.getByRole("button", { name: "Sunday" }).click();
      await expect(page.getByText("6 days · 3h a week")).toBeVisible();
    });

    await answerAge(page, 1995);

    // Number keys pick the look, as on every list, and Enter continues.
    await expect(page.getByRole("heading", { name: "How do you like to study?" })).toBeVisible();
    await page.keyboard.press("2");
    await expect(page.getByRole("radio", { name: /^Fun/u })).toBeChecked();
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /^Focus/u })).toBeChecked();
    await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "I'd rather start from scratch" }).click();

    // The plan is written in the background; until then the reveal says so instead of a bare spinner.
    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();

    const saved = await prisma.goal.findUniqueOrThrow({
      include: { user: true },
      where: { id: created.id },
    });

    expect(saved.user.isAnonymous).toBe(true);
    expect(saved.dailyMinutes).toBe(30);

    expect(saved.details).toMatchObject({
      answered: expect.arrayContaining(["purpose", "targetDate", "level", "schedule", "placement"]),
      level: "basic",
      purpose: "overview",
    });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: saved.userId },
    });

    expect(profile).toMatchObject({
      activeGoalId: created.id,
      birthMonth: 3,
      birthYear: 1995,
      experienceMode: "focus",
    });
  });

  test("choosing Fun turns the next screens Fun and brings the buddy", async ({ page }) => {
    const goal = await typeGoal(page, {
      result: {
        dailyMinutes: 20,
        followUps: [],
        goals: [
          {
            kind: "learn",
            ownLevel: "none",
            purpose: "overview",
            subject: "astronomy",
            targetDate: "2099-01-31",
            title: "Learn astronomy",
          },
        ],
        route: "goals",
      },
      words: "learn astronomy from zero by 2099, 20 min a day",
    });

    await expect(page.getByText("20 min a day")).toBeVisible();
    const created = await confirmGoal(page, goal);

    await answerAge(page, 1990);

    await continueWith(page, "How do you like to study?", () =>
      page.getByText("Fun", { exact: true }).click(),
    );

    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mode)).toBe("fun");

    await page.getByRole("radio", { name: /Otto/u }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Octavia");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    // Starting from nothing skips placement: every phase starts at its beginning.
    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();

    const profile = await prisma.userLearningProfile.findFirstOrThrow({
      where: { activeGoalId: created.id },
    });

    expect(profile).toMatchObject({
      buddyKind: "otto",
      buddyName: "Octavia",
      experienceMode: "fun",
    });
  });

  test("a visitor already in Fun keeps it through the questions, with Fun preselected", async ({
    page,
  }) => {
    const goal = await typeGoal(page, {
      mode: "fun",
      result: {
        dailyMinutes: 20,
        followUps: [],
        goals: [
          {
            kind: "learn",
            ownLevel: "none",
            purpose: "overview",
            subject: "geology",
            targetDate: "2099-01-31",
            title: "Learn geology",
          },
        ],
        route: "goals",
      },
      words: "learn geology from zero by 2099, 20 min a day",
    });

    await confirmGoal(page, goal);

    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mode)).toBe("fun");

    await answerAge(page, 1990);

    await expect(page.getByRole("heading", { name: "How do you like to study?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Fun/u })).toBeChecked();
  });

  test("offers a Library course that teaches the goal once the answers are in", async ({
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
            targetDate: "2099-01-31",
            title: `Learn about ${subject}`,
          },
        ],
        route: "goals",
      },
      words: `learn about ${subject}`,
    });

    await confirmGoal(page, goal);
    await answerAge(page, 1990);
    await continueWith(page, "How do you like to study?");

    // Starting from nothing skips placement, so the plan comes next.
    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();

    await expect(
      page.getByRole("link", { name: /A course in the Library fits your goal/u }),
    ).toHaveAttribute("href", `/b/${org.slug}/c/${course.slug}`);
  });

  test("an exam shows its official dates with the source, and asks only what's missing", async ({
    page,
  }) => {
    const goal = await typeGoal(page, {
      result: {
        followUps: [],
        goals: [
          {
            examName: "ENEM",
            institution: "a federal university",
            kind: "exam",
            subject: "ENEM",
            targetCourse: "Nursing",
            targetScore: "An average of about 700",
            title: "Pass the ENEM",
          },
        ],
        route: "goals",
        studyTime: "21:30",
        studyTimeNote: "At night, after school",
      },
      words: "pass the enem for nursing, i study at night",
    });

    await expect(page.getByText("Pass the ENEM", { exact: true })).toBeVisible();
    await expect(page.getByText("Nursing", { exact: true })).toBeVisible();
    await expect(page.getByText("Where: a federal university")).toBeVisible();
    await expect(page.getByText("An average of about 700")).toBeVisible();
    await expect(page.getByText(/days? left/u)).toBeVisible();
    await expect(page.getByRole("link", { name: /source:/u })).toBeVisible();
    await expect(page.getByText("At night, after school")).toBeVisible();

    // Fix one fact in place: the goal's title, their own exam day and when they study. Each fix is
    // saved on the draft; closing an edit gives focus back to that row's pencil.
    await page.getByRole("button", { name: "Edit Goal" }).click();
    await page.getByRole("textbox", { name: "Goal" }).fill("Pass the ENEM this year");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Pass the ENEM this year", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Goal" })).toBeFocused();

    await page.getByRole("button", { name: "Edit Dates" }).click();
    await page.getByLabel("Dates").fill("2099-11-20");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Deadline")).toBeVisible();
    await expect(page.getByRole("link", { name: /source:/u })).toBeHidden();
    // Their own day replaces the official dates, and its row keeps the focus.
    await expect(page.getByRole("button", { name: "Edit Deadline" })).toBeFocused();

    await page.getByRole("button", { name: "Edit When you study" }).click();
    await page.getByLabel("When you study").fill("20:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("8:00 PM")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit When you study" })).toBeFocused();

    const created = await confirmGoal(page, goal);

    expect(created).toMatchObject({
      kind: "exam",
      studyTime: "20:00",
      title: "Pass the ENEM this year",
    });

    expect(created.targetDate?.toISOString().slice(0, 10)).toBe("2099-11-20");
    expect(created.examBlueprintId).not.toBeNull();

    // The exam is named apart from the question, so no language needs an article for it.
    await expect(page.getByRole("main").getByText("ENEM", { exact: true })).toBeVisible();

    await continueWith(page, "How much do you already know?", () =>
      page.getByText("The basics").click(),
    );

    // The time they gave comes preselected.
    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "8:00 PM" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
            targetDate: "2099-03-31",
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

    await expect(
      page.getByRole("heading", { name: "How much time can you study each day?" }),
    ).toBeVisible();
  });

  test("an unsafe goal is declined kindly, with another way to start", async ({ page }) => {
    await typeGoal(page, {
      result: { route: "unsafe" },
      words: "how to get into someone's account",
    });

    await expect(page.getByRole("heading", { name: "We can't help with this goal" })).toBeVisible();
    await page.getByRole("button", { name: "Try another goal" }).click();
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  });

  test("a vague goal asks for a bit more instead of guessing", async ({ page }) => {
    await typeGoal(page, { result: { route: "unclear" }, words: "be better" });
    await expect(page.getByRole("heading", { name: "Tell us a bit more" })).toBeVisible();
  });

  test("an instrument joins the waitlist and offers musicianship today", async ({ page }) => {
    await typeGoal(page, {
      mode: "fun",
      result: { instrument: "guitar", route: "instrument" },
      words: "play the guitar",
    });

    await expect(
      page.getByRole("heading", { name: "Lessons for playing guitar are coming" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.getByText("Create an account so we can let you know.")).toBeVisible();

    await page.getByRole("button", { name: "Start musicianship" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();
  });

  test("under 13 can't use Zoonk, and nothing they entered is kept", async ({ page }) => {
    const goal = await typeGoal(page, {
      result: {
        dailyMinutes: 15,
        followUps: [],
        goals: [
          {
            kind: "learn",
            ownLevel: "none",
            purpose: "overview",
            subject: "dinosaurs",
            targetDate: "2099-01-31",
            title: "Learn about dinosaurs",
          },
        ],
        route: "goals",
      },
      words: "learn about dinosaurs",
    });

    const created = await confirmGoal(page, goal);
    await answerAge(page, new Date().getFullYear() - 10);

    await expect(
      page.getByRole("heading", { name: "Zoonk is for learners 13 and older" }),
    ).toBeVisible();

    await expect.poll(() => prisma.user.findUnique({ where: { id: created.userId } })).toBeNull();
  });

  test("an account under 13 says goodbye under the visitor's bar, not the deleted learner's", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({
      details: { answered: ["schedule", "targetDate"], level: "none", purpose: "overview" },
      kind: "learn",
      title: `Learn about dinosaurs ${randomUUID().slice(0, 8)}`,
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);
    await expect(page.getByRole("button", { name: /Current goal:/u })).toBeVisible();
    await answerAge(page, new Date().getFullYear() - 10);

    await expect(
      page.getByRole("heading", { name: "Zoonk is for learners 13 and older" }),
    ).toBeVisible();

    const bar = page.getByRole("banner");
    await expect(bar.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "User menu" })).toBeHidden();
    await expect(bar.getByRole("link", { name: "Set a goal" })).toBeHidden();
    await expect(bar.getByRole("button", { name: /Current goal:/u })).toBeHidden();

    await expect
      .poll(() => prisma.user.findUnique({ where: { id: noProgressUser.id } }))
      .toBeNull();
  });

  test("start over sets the goal aside and goes back to the first question", async ({ page }) => {
    const goal = await typeGoal(page, {
      result: QUANTUM,
      words: "understand quantum physics again",
    });

    const created = await confirmGoal(page, goal);

    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: created.id } });
        return saved.status;
      })
      .toBe("archived");
  });

  test("a visitor's paperclip asks for an account first", async ({ page }) => {
    await page.goto("/start");
    await page.getByRole("button", { name: "Study your own material" }).click();

    await expect(page.getByText(/Create a free account to add a PDF/u)).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("material attached with the paperclip goes with the goal", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const source = await sourceFixture({ kind: "upload", title: "My chemistry notes" });
    await learnerSourceFixture({ sourceId: source.id, userId: noProgressUser.id });

    // The uploads API stores the pasted text; here it answers as it would.
    await page.route("**/v1/uploads", (route) =>
      route.fulfill({
        json: { checkingVisibility: false, source: { id: source.id, title: source.title } },
        status: 201,
      }),
    );

    const goal = `learn chemistry from my notes ${randomUUID().slice(0, 8)}`;

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "chemistry", title: "Learn chemistry" }],
        route: "goals",
      },
    });

    await page.goto("/start");
    await page.getByRole("button", { name: "Study your own material" }).click();
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill("Atoms, bonds and reactions.");
    await page.getByRole("button", { name: "Add text" }).click();

    await expect(
      page.getByRole("list", { name: "Your material" }).getByText("My chemistry notes"),
    ).toBeVisible();

    await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
    await page.getByRole("button", { name: "Start with your goal" }).click();
    const created = await confirmGoal(page, goal);

    await expect
      .poll(async () => {
        const linked = await prisma.learnerSource.findFirstOrThrow({
          where: { sourceId: source.id, userId: noProgressUser.id },
        });

        return linked.goalId;
      })
      .toBe(created.id);
  });
});
