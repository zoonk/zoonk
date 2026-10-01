import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { z } from "zod";
import { type Page, expect, test } from "./fixtures";
import { type Mode, asPersona } from "./learn-personas";
import { SCREEN_TUTOR_ANSWER, askSuggestion, stubScreenTutor } from "./screen-tutor";
import { createStudyDay, openAs } from "./study-day";

/**
 * The Plan tab (the Route in Fun) for Ana's ENEM goal: the plan at three zoom levels, the route
 * and its link, plan changes with their reason and undo, votes, steering, schedule edits and
 * test-outs. For Maya's huge goal, the estimate the screen computes agrees with the phases it
 * shows, going without tools says what that path can't give, and "Ask" answers about the plan and
 * its course.
 */

async function openPlan(page: Page, mode: Mode) {
  await page.goto("/plan");

  await expect(
    mode === "fun"
      ? page.getByRole("heading", { level: 1, name: "Route" })
      : page.getByRole("heading", { level: 1, name: /^Until /u }),
  ).toBeVisible();
}

const phasesSchema = z.array(z.object({ endDate: z.iso.date(), minutes: z.number() }));

/** The plan as the seed stored it: its size, and each phase's size and last day. */
async function loadStoredPlan(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return { hours: plan.estimateHours ?? 0, phases: phasesSchema.parse(plan.phases) };
}

function formatDate(isoDate: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(isoDate));
}

async function loadPlanSettings(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return plan.settings;
}

test.describe("Plan tab", () => {
  test("Focus shows the plan at three zoom levels with test-outs and votes, by keyboard too", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      await openPlan(page, "focus");

      await expect(page.getByText(/min a day · \d days a week/u)).toBeVisible();

      await expect(page.getByRole("tab", { name: "Until the goal" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await expect(page.getByRole("heading", { name: "Phase 1: Foundations" })).toBeVisible();

      await expect(page.getByText("Phase 4: Final stretch")).toBeVisible();
      await expect(page.getByRole("link", { name: "Test out of Porcentagem" })).toBeVisible();
      await expectAccessibleScreen(page, "the plan");

      // The plan takes a vote, and so does its latest change (changes are listed newest first).
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const steering = page.getByRole("region", { name: "How is it going?" });
      await steering.getByRole("button", { exact: true, name: "Helpful" }).click();

      await expect
        .poll(() =>
          prisma.contentFeedback.findFirst({ where: { contentId: plan.id, userId: user.id } }),
        )
        .toMatchObject({ contentKind: "plan", vote: "up" });

      const changes = page.getByRole("region", { name: "Changes to your plan" });
      await changes.getByRole("button", { exact: true, name: "Not helpful" }).first().click();
      await page.getByRole("button", { name: "Skip" }).click();

      await expect
        .poll(() =>
          prisma.contentFeedback.findFirst({
            where: { contentKind: "planChange", userId: user.id },
          }),
        )
        .toMatchObject({ vote: "down" });

      // The zoom levels are tabs: arrows move between them and Enter picks one.
      await page.getByRole("tab", { name: "Until the goal" }).focus();
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByRole("tab", { name: "Week" })).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("tab", { name: "Week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();

      await expect(
        page.getByRole("region", { name: "This week" }).getByText("Mock exam"),
      ).toBeVisible();

      await page.getByRole("tab", { name: "Today" }).click();
      await expect(page.getByRole("tabpanel").getByRole("listitem")).not.toHaveCount(0);
    });
  });

  test("a plan started today counts no earlier day and never reads 0 h", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    await openPlan(page, "focus");

    await expect(page.getByText(/~0 h/u)).toHaveCount(0);

    await page.getByRole("tab", { name: "Week" }).click();
    const week = page.getByRole("region", { name: "This week" });
    await expect(week.getByRole("listitem").first()).toBeVisible();
    await expect(week.locator("li[data-state=done], li[data-state=missed]")).toHaveCount(0);
    await page.context().close();
  });

  test("Fun draws the route with moons, markers and the pace, and shares its link", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await openPlan(page, "fun");

      const route = page.getByRole("list", { name: "Phases of your route" });

      await expect(route.getByRole("heading", { level: 3 })).toHaveCount(4);
      await expect(route.getByText(/Phase 1 · You are here/u)).toBeVisible();
      await expect(route.getByText(/^Boss · /u)).toBeVisible();
      await expect(page.getByRole("region", { name: "You vs. plan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
      await expectAccessibleScreen(page, "the Route");

      await page.getByRole("button", { name: "Share this plan" }).click();
      await expect(page.getByText("Link copied")).toBeVisible();

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const copied = await page.evaluate(() => navigator.clipboard.readText());

      expect(copied).toMatch(new RegExp(`/plan-link/${plan.id}$`, "u"));

      // The owner opening their own link lands on their plan, the Route in Fun.
      await page.goto(`/plan-link/${plan.id}`);
      await expect(page).toHaveURL(/\/plan$/u);
      await expect(page.getByRole("heading", { level: 1, name: "Route" })).toBeVisible();
    });
  });

  test("steering changes the plan from the keyboard, with an undo", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      await openPlan(page, "focus");

      const morePractice = page.getByRole("button", { name: "More practice" });
      await morePractice.focus();
      await page.keyboard.press("Space");

      await expect(morePractice).toHaveAttribute("aria-pressed", "true");
      // Saving doesn't drop focus to the page: the toggle keeps it while it waits and after.
      await expect(morePractice).toBeFocused();
      const change = page.getByRole("listitem").filter({ hasText: "More practice from now on." });
      await expect(change).toBeVisible();

      await expect
        .poll(async () => loadPlanSettings(user.goalId))
        .toMatchObject({ practiceBias: "morePractice" });

      await change.getByRole("button", { name: "Undo" }).click();
      await expect(change.getByText("Undone")).toBeVisible();
      await expect(morePractice).toHaveAttribute("aria-pressed", "false");

      // Undo leaves with the undo, so focus moves to the change it undid.
      await expect(change).toBeFocused();
    });
  });

  test("the schedule changes from the edit panel", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await openPlan(page, "focus");

      await page.getByRole("button", { exact: true, name: "Edit" }).click();
      await page.getByLabel("Time a day").selectOption("60");

      await expect(
        page.getByRole("listitem").filter({ hasText: "Daily time changed to 60 min." }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Make next week light" }).click();
      const lightWeek = page.getByRole("button", { name: "Next week is light" });
      await expect(lightWeek).toBeDisabled();
      await expect(lightWeek).toBeFocused();
    });
  });

  test("a chapter test-out ends with a kind result and leads back", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await openPlan(page, "focus");
      await page.getByRole("link", { name: "Test out of Porcentagem" }).click();

      await expect(page.getByText("Test out: Porcentagem")).toBeVisible();

      const progress = page.getByRole("progressbar", { name: /^Question 1 of \d+$/u });
      const label = await progress.getAttribute("aria-label");
      const total = Number(label?.match(/of (?<total>\d+)/u)?.groups?.total);

      for (const question of Array.from({ length: total }, (_, index) => index + 1)) {
        // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
        await expect(
          page.getByRole("progressbar", { name: `Question ${question} of ${total}` }),
        ).toBeVisible();

        // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
        await page.getByRole("button", { name: "I don't know yet" }).click();
      }

      await expect(page.getByRole("heading", { name: "Not yet, and that's fine" })).toBeVisible();

      await page.getByRole("link", { name: "Back to the plan" }).click();
      await expect(page.getByRole("heading", { level: 1, name: /^Until /u })).toBeVisible();
    });
  });
});

test.describe("Plan tab for a huge learn goal", () => {
  test("Focus shows an estimate that adds up to its phases, the chapter she's in and this week's challenge", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      const { hours, phases } = await loadStoredPlan(user.goalId);
      const [, ...later] = phases;

      await page.goto("/plan");
      await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();

      await expect(page.getByText(`~${Math.round(hours)} h`, { exact: true })).toBeVisible();

      await expect(
        page.getByText(
          formatDate(phases.at(-1)?.endDate ?? "", { month: "long", year: "numeric" }),
          { exact: true },
        ),
      ).toBeVisible();

      await Promise.all(
        later.map((phase) =>
          expect(page.getByText(`~${Math.round(phase.minutes / 60)} h`).first()).toBeVisible(),
        ),
      );

      // Placement tested her basics out whole: they're done by name, apart from lessons to write.
      const chapters = page.locator("ul > li[data-state]");
      await expect(chapters.and(page.locator('[data-state="current"]'))).toHaveText(/^Exponents/u);

      const settled = chapters.filter({
        hasText:
          "Read a fraction as a division, Find a percent of a number, Solve a linear equation and 1 more",
      });

      await expect(settled).toHaveAttribute("data-state", "done");
      await expect(settled).toContainText("You already know this");

      await expect(page.getByText("Lessons being written")).toHaveCount(1);

      await page.getByRole("tab", { name: "Week" }).click();

      await expect(
        page.getByRole("region", { name: "This week" }).getByText("Weekly challenge"),
      ).toBeVisible();
    });
  });

  test("Fun closes the phase with its boss, points out this week's challenge, goes without tools and answers about the plan and its course", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "hugeGoal" }, async ({ page, user }) => {
      const [{ phases }, asked] = await Promise.all([
        loadStoredPlan(user.goalId),
        stubScreenTutor(page),
      ]);

      const [current] = phases;

      // A phase ends with a phase checkpoint, so the week's challenge is the one this Sunday.
      await page.goto("/today");
      await expect(page.getByText("Sunday: Big Challenge", { exact: true })).toBeVisible();

      await page.goto("/plan");
      await expect(page.getByRole("heading", { level: 1, name: "Route" })).toBeVisible();

      const route = page.getByRole("list", { name: "Phases of your route" });

      await expect(route.getByRole("heading", { level: 3 })).toHaveCount(phases.length);

      await expect(
        route.getByText(
          `Boss · ${formatDate(current?.endDate ?? "", { day: "numeric", month: "short" })}`,
        ),
      ).toBeVisible();

      await expect(route.getByText("Big Challenge · Sunday")).toBeVisible();

      const tools = page.getByRole("region", { name: "You'll use" });

      await tools
        .getByRole("button", { name: "No tools? You can do it all with examples." })
        .click();

      const note = tools.getByText("You won't practice on your own computer.", { exact: false });
      await expect(note).toBeVisible();

      // The button leaves once it's chosen, so focus moves to the note that replaces it.
      await expect(note).toBeFocused();

      // Tools only later phases use wait under "More later" until the learner opens it.
      await tools.getByText(/^More later: /u).click();
      await expect(tools.getByText("Examples only")).toHaveCount(2);

      // The plan's tutor also sees the course it's built from, so the plan has one "Ask".
      await expect(page.getByRole("button", { name: /^Ask about/u })).toHaveCount(1);

      const tutor = await askSuggestion({
        ask: "Ask about your plan",
        description: "Ask questions about your plan",
        page,
        suggestion: "Why am I studying this today?",
      });

      await expect(tutor.getByRole("button", { name: "What comes next?" })).toBeHidden();

      const textbox = tutor.getByRole("textbox", { name: "Ask a question" });
      await textbox.fill("How is this course organized, level by level?");
      await tutor.getByRole("button", { name: "Send" }).click();
      await expect(tutor.getByText(SCREEN_TUTOR_ANSWER)).toHaveCount(2);

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({ context: { kind: "plan" }, suggested: true }),
          path: `/v1/goals/${user.goalId}/plan/questions`,
        },
        {
          input: expect.objectContaining({
            context: { kind: "plan" },
            question: "How is this course organized, level by level?",
          }),
          path: `/v1/goals/${user.goalId}/plan/questions`,
        },
      ]);

      expect(asked[1]?.input.suggested).toBeUndefined();
    });
  });
});
