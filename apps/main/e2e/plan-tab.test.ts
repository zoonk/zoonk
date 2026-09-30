import { prisma } from "@zoonk/db";
import { z } from "zod";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, asPersona } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * The Plan tab (the Route in Fun) for Ana's ENEM goal: the plan at three zoom levels, the route,
 * plan changes with their reason and undo, proposals, steering, schedule edits and test-outs. For
 * Maya's huge goal, the estimate the screen computes agrees with the phases it shows.
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
  test("Focus shows the plan at three zoom levels with test-outs", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await openPlan(page, "focus");

      await expect(page.getByText(/min a day · \d days a week/u)).toBeVisible();

      await expect(page.getByRole("tab", { name: "Until the goal" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await expect(page.getByRole("heading", { name: "Phase 1: Foundations" })).toBeVisible();

      await expect(page.getByText("Phase 4: Final stretch")).toBeVisible();
      await expect(page.getByRole("link", { name: "Test out of Porcentagem" })).toBeVisible();

      await page.getByRole("tab", { name: "Week" }).click();
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

  test("Fun draws the route with moons, markers and the pace", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page }) => {
      await openPlan(page, "fun");

      const route = page.getByRole("list", { name: "Phases of your route" });

      await expect(route.getByRole("heading", { level: 3 })).toHaveCount(4);
      await expect(route.getByText(/Phase 1 · You are here/u)).toBeVisible();
      await expect(route.getByText(/^Boss · /u)).toBeVisible();
      await expect(page.getByRole("region", { name: "You vs. plan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    });
  });

  for (const mode of MODES) {
    test(`steering changes the plan with an undo in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        await openPlan(page, mode);

        const morePractice = page.getByRole("button", { name: "More practice" });
        await morePractice.click();

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

    test(`a proposal waits for the learner's answer in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        await openPlan(page, mode);

        const proposal = page.getByRole("listitem").filter({ hasText: "Waiting for your OK" });
        await expect(proposal).toContainText("sábado");

        await proposal.getByRole("button", { name: "Not now" }).click();
        await expect(page.getByText("Waiting for your OK")).toBeHidden();

        // The declined proposal leaves the list, so focus moves to the plan's changes.
        await expect(page.getByRole("heading", { name: "Changes to your plan" })).toBeFocused();

        await expect
          .poll(async () => {
            const plan = await prisma.plan.findUniqueOrThrow({
              include: { changes: { where: { status: "declined" } } },
              where: { goalId: user.goalId },
            });

            return plan.changes.length;
          })
          .toBe(1);
      });
    });

    test(`the schedule changes from the edit panel in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page }) => {
        await openPlan(page, mode);

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
  }

  for (const mode of MODES) {
    test(`sharing the plan copies its link in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await openPlan(page, mode);

        await page.getByRole("button", { name: "Share this plan" }).click();
        await expect(page.getByText("Link copied")).toBeVisible();

        const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
        const copied = await page.evaluate(() => navigator.clipboard.readText());

        expect(copied).toMatch(new RegExp(`/plan-link/${plan.id}$`, "u"));
      });
    });
  }

  test("zoom levels and steering work from the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await openPlan(page, "focus");

      await page.getByRole("tab", { name: "Until the goal" }).focus();
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByRole("tab", { name: "Week" })).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("tab", { name: "Week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();

      const tooHard = page.getByRole("button", { name: "Too hard" });
      await tooHard.focus();
      await page.keyboard.press("Space");
      await expect(tooHard).toHaveAttribute("aria-pressed", "true");
      await expect(tooHard).toBeFocused();
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

  test("a test-out can be answered from the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page }) => {
      await page.goto("/plan");
      await page.getByRole("link", { name: "Test out of Porcentagem" }).click();

      await expect(page.getByText("Test out: Porcentagem")).toBeVisible();
      await page.keyboard.press("1");
      await expect(page.getByRole("button", { name: "R$ 360", pressed: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^(?:Next|Finish)$/u })).toBeEnabled();

      // Enter moves on with the picked answer, as Next does.
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "R$ 360", pressed: true })).toBeHidden();
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

  test("Fun closes the phase with its boss and points out this week's challenge", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "hugeGoal" }, async ({ page, user }) => {
      const { phases } = await loadStoredPlan(user.goalId);
      const [current] = phases;

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
    });
  });
});
