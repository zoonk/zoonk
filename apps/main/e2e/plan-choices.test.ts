import { type Browser, type Locator, type Page } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { dayFromToday } from "./short-exam-fixtures";
import { openAs } from "./study-day";
import { routeBasesAdvice } from "./time-to-cover-routes";

/**
 * When time is short, the learner chooses: how to study the prerequisites the plan builds on
 * (learn them first, only their essentials, or skip them; a subject at once or each one), with
 * what the choices do before they're saved, and studying everything at their own pace (an exam's
 * after it, keeping its date; any other goal without its deadline, which can come back).
 */

/** Every onboarding screen before the plan, so the goal has its Plan. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

async function loadPlanSettings(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? plan.settings : {};
}

async function loadBaseChoices(goalId: string) {
  const settings = await loadPlanSettings(goalId);
  return settings.baseChoices ?? [];
}

/** The identity of each lesson the plan holds for a skill. */
async function loadPlannedLessonKeys(skillId: string) {
  const items = await prisma.planItem.findMany({
    select: { lesson: { select: { identityKey: true } } },
    where: { kind: "lesson", skillId },
  });

  return items.map((item) => item.lesson?.identityKey ?? null);
}

async function loadTargetDate(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

/**
 * Starting the day Today shows (a POST) lays out the plan the goal's run handed over. The tap moves
 * to the session before its POST answers; the day's session commits with the plan, so it's there
 * once the plan is.
 */
async function startTodaysDay({ goalId, page }: { goalId: string; page: Page }) {
  await page.goto("/today");

  await page
    .getByRole("region", { name: "Today's session" })
    .getByRole("button", { name: /^Start/u })
    .click();

  await expect.poll(() => prisma.studySession.count({ where: { goalId } })).toBe(1);
}

/** A learner whose plan builds on bases, with it as their active goal, who started their day. */
async function openLearnerWithBases(
  browser: Browser,
  { days, kind }: { days: number; kind: "exam" | "learn" },
) {
  const user = await createE2EUser(getBaseURL());

  const fixture = await goalWithBasesFixture({
    days,
    details: { answered: ALL_ANSWERED },
    kind,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });

  const page = await openAs(browser, user);

  await startTodaysDay({ goalId: fixture.goal.id, page });
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

  return { ...fixture, page };
}

function choiceButton({
  choice,
  group,
}: {
  choice: "Essential" | "In depth" | "Quick lesson" | "Skip";
  group: Locator;
}) {
  return group.getByRole("button", { name: new RegExp(`^${choice}`, "u") });
}

test.describe("Plan choices", () => {
  test("an exam a month away: prerequisites by subject or one by one, with their effect, then studying everything after the exam", async ({
    browser,
  }) => {
    const { area, bases, goal, page } = await openLearnerWithBases(browser, {
      days: 30,
      kind: "exam",
    });

    const [cells, living] = bases;

    // Main's E2E runs without the API, which works out the recommendation when she asks: it plans
    // the goal with every prerequisite in depth.
    const advised = await routeBasesAdvice(page, {
      advice: { daysLeft: 30, ready: true, recommended: "quick" },
      goalId: goal.id,
    });

    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    await editor.getByRole("button", { name: "Choose prerequisites" }).click();

    const sheet = page.getByRole("dialog", { name: "Prerequisites" });

    const advice =
      "30 days left: we recommend a quick lesson for each prerequisite, so there's time for what comes up most.";

    // Nothing is recommended until she asks: no page works it out.
    await expect(sheet.getByText(advice)).toHaveCount(0);
    expect(advised).toHaveLength(0);
    await sheet.getByRole("button", { name: "Get a recommendation" }).click();

    // A month away with little time, the app recommends a quick lesson for each and says why.
    await expect(sheet.getByText(advice)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Use the recommendation" })).toBeFocused();

    // The subject is one choice for both, with the time each of the four ways takes; the plan
    // studies their essentials until the learner chooses.
    const subject = sheet.getByRole("group", { exact: true, name: area });

    await expect(sheet.getByText("2 prerequisites")).toBeVisible();
    await expect(sheet.getByText("For Heredity and Ecology")).toBeVisible();

    await expect(choiceButton({ choice: "Essential", group: subject })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(subject.getByRole("button")).toHaveCount(4);
    await expectAccessibleScreen(page, "the prerequisites sheet");

    // The recommendation is one tap, and its effect shows before anything is saved. The keyboard
    // moves on to Save choices, which opens once the check is done.
    await sheet.getByRole("button", { name: "Use the recommendation" }).click();
    await expect(sheet.getByRole("button", { name: "Save choices" })).toBeFocused();

    await expect(choiceButton({ choice: "Quick lesson", group: subject })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(sheet.getByText(/^By your date: \d+% of the exam, /u)).toBeVisible();
    await expect(loadBaseChoices(goal.id)).resolves.toStrictEqual([]);

    // Opened, the subject chooses each one: skipping one leaves the subject without one choice.
    await sheet.getByRole("button", { name: "Choose each one" }).click();

    await choiceButton({
      choice: "Skip",
      group: sheet.getByRole("group", { name: living?.name }),
    }).click();

    await expect(sheet.getByText("Different choices for each one.")).toBeVisible();
    await expect(subject.getByRole("button", { pressed: true })).toHaveCount(0);

    await sheet.getByRole("button", { name: "Save choices" }).click();

    await expect(sheet.getByRole("status")).toContainText(
      "1 prerequisite gets a quick lesson. 1 prerequisite is skipped.",
    );

    await expect
      .poll(() => loadBaseChoices(goal.id))
      .toStrictEqual([
        { choice: "quick", skillId: cells?.skillId },
        { choice: "skip", skillId: living?.skillId },
      ]);

    // The quick lesson is a lesson of its own in the plan, written when the learner gets to it.
    await expect
      .poll(() => loadPlannedLessonKeys(cells?.skillId ?? ""))
      .toStrictEqual([`quick:${cells?.skillId}`]);

    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();
    await editor.getByRole("button", { name: "Close" }).click();
    await expect(editor).toBeHidden();

    // Studying everything keeps the exam's date: its sheet, one of the Plan suggestion's other
    // options, says what it does before she chooses it. When everything would end takes planning
    // it, so the change says that once she chooses.
    const suggestion = page.locator('[data-slot="suggestion-panel"]').filter({ visible: true });
    await suggestion.getByRole("button", { name: "Other options" }).click();
    await page.getByRole("menuitem", { name: "Study everything after the exam" }).click();
    const everything = page.getByRole("dialog", { name: "Study everything" });
    await expect(everything).toContainText("Every topic, even after the exam, at your own pace.");
    await expect(everything.getByText(/you finish in /u)).toHaveCount(0);

    await expectAccessibleScreen(page, "the study everything sheet");

    await everything.getByRole("button", { name: "Study everything" }).click();

    await expect(everything.getByRole("status")).toContainText(
      "You study everything: what doesn't fit before the exam comes after it.",
    );

    await everything.getByRole("button", { name: "Done" }).click();
    await expect(everything).toBeHidden();
    await expect.poll(() => loadPlanSettings(goal.id)).toMatchObject({ fullCourse: true });

    // The path goes on past the exam, its mocks there for the next sitting, and the Plan's
    // suggestion ends it at the exam again, once she's seen what that moves.
    const next = page.getByRole("region", { name: "Next on your path" });
    const after = next.getByRole("listitem").last();
    await expect(after).toContainText("After the exam");
    await expect(after).toContainText(/\d+ mock exams? for the next sitting/u);

    await expect(suggestion.getByRole("heading")).toHaveText(/after the exam on /u);
    await suggestion.getByRole("button", { name: "Preview" }).click();
    await suggestion.getByRole("button", { name: "Apply" }).click();

    await expect.poll(() => loadPlanSettings(goal.id)).toMatchObject({ fullCourse: false });
    await expect(next.getByText("After the exam")).toHaveCount(0);

    await page.context().close();
  });

  test("prerequisites switched back save what their preview said, lessons included", async ({
    browser,
  }) => {
    const { area, page } = await openLearnerWithBases(browser, { days: 30, kind: "exam" });

    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    const sheet = page.getByRole("dialog", { name: "Prerequisites" });
    const subject = sheet.getByRole("group", { exact: true, name: area });
    // The preview's live region: the recommendation's box, asked for, is one too.
    const preview = sheet.locator('[aria-live="polite"][aria-busy]');

    /** Chooses for the subject, saves after reading the preview, and returns what it said. */
    const chooseAndSave = async (choice: "Essential" | "In depth") => {
      await editor.getByRole("button", { name: "Choose prerequisites" }).click();
      await choiceButton({ choice, group: subject }).click();
      await expect(preview).toHaveAttribute("aria-busy", "false");
      const lines = await preview.getByRole("paragraph").allTextContents();
      await sheet.getByRole("button", { name: "Save choices" }).click();
      await expect(sheet.getByRole("status")).toBeVisible();
      return lines;
    };

    await chooseAndSave("In depth");
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();

    // Back to the essentials: the preview names the lessons that leave, and saving does just
    // that instead of undoing the change before it.
    const lines = await chooseAndSave("Essential");
    const lessons = lines.find((line) => /^(?:Adds|Leaves out) /u.test(line));

    expect(lessons).toBeDefined();
    await expect(sheet.getByRole("status")).toContainText(lessons ?? "");
    await expect(sheet.getByRole("status")).not.toContainText("Undone");

    await page.context().close();
  });

  test("a goal with a deadline studies everything without it, and sets one again", async ({
    browser,
  }) => {
    const { goal, page } = await openLearnerWithBases(browser, { days: 20, kind: "learn" });

    // Studying everything is one of the Plan suggestion's other options.
    const suggestion = page.locator('[data-slot="suggestion-panel"]').filter({ visible: true });
    await suggestion.getByRole("button", { name: "Other options" }).click();
    await page.getByRole("menuitem", { exact: true, name: "Study everything" }).click();
    const everything = page.getByRole("dialog", { name: "Study everything" });

    // When she'd finish takes planning it: the change says it once she chooses.
    await expect(everything.getByText(/you finish in /u)).toHaveCount(0);
    await expect(everything.getByText(/^Your deadline of .+ comes off your plan\./u)).toBeVisible();

    await everything.getByRole("button", { name: "Study everything" }).click();

    await expect(everything.getByRole("status")).toContainText(
      "No deadline: you study everything at your own pace.",
    );

    await expect(everything.getByRole("status")).toContainText(/You finish around .+\./u);

    await everything.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => loadTargetDate(goal.id)).toBeNull();

    // The plan editor sets a deadline again.
    const deadline = dayFromToday(40).toISOString().slice(0, 10);

    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });

    await editor.getByLabel("Deadline").fill(deadline);
    await editor.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => loadTargetDate(goal.id)).toBe(deadline);

    await page.context().close();
  });

  test("an exam's plan reveal says what its time covers, with the topics and Adjust, and the other ways in the editor", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const { goal } = await goalWithBasesFixture({
      days: 30,
      details: { answered: ALL_ANSWERED },
      kind: "exam",
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const page = await openAs(browser, user);

    // Starting the day lays out the plan the reveal shows.
    await startTodaysDay({ goalId: goal.id, page });
    await page.goto(`/start/${goal.id}`);
    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

    // One honest sentence on what her time covers, with the topics one tap away; the time step
    // offered Find, and Adjust holds the rest: never four buttons that read alike.
    const coverage = page.locator('[data-slot="reveal-coverage"]');
    await expect(coverage.getByRole("button")).toHaveText(["See topics"]);

    await page.getByRole("button", { exact: true, name: "Adjust" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });

    await expect(
      editor.getByRole("switch", { name: "Keep studying after the exam" }),
    ).toBeVisible();

    await page.context().close();
  });
});
