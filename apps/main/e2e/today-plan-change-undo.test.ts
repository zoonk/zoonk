import { type Request, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { createProposalPlan } from "./proposal-plan";
import { openAs } from "./study-day";

/** What the plan-edit model said of the learner's words, stored with the change. */
const PROPOSAL = "Twenty-five minutes a day keeps your plan on track for the exam.";

/** Where the browser reads Today's view again, instead of rendering the page again. */
const TODAY_VIEW_PATH = "/api/learner/views/today";

test.describe("Undoing a plan change on Today", () => {
  test("keeps the applied confirmation and Undo retry when Undo cannot save", async ({
    browser,
  }) => {
    // A small plan the planner made, with this proposal the only one waiting, so the fresh view has
    // no change once Apply saves it.
    const { plan, user } = await createProposalPlan({
      specs: [{ area: "Stocks", lessons: 4, name: "Financial basics" }],
    });

    const original = await prisma.goal.findUniqueOrThrow({ where: { id: plan.goalId } });

    const change = await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 90 }], source: "planEdit" },
      planId: plan.id,
      reason: PROPOSAL,
      status: "proposed",
    });

    const page = await openAs(browser, user);

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/today");
      const note = page.getByRole("region", { name: "Suggested change" });

      const freshRead = page.waitForResponse(async (response) => {
        if (
          new URL(response.url()).pathname !== TODAY_VIEW_PATH ||
          response.request().method() !== "GET" ||
          !response.ok()
        ) {
          return false;
        }

        const body = await response.json();
        return body.status === "ready" && body.copy.view.today.planChange === null;
      });

      await note.getByRole("button", { name: "Apply" }).click();

      await expect(note.getByRole("status")).toHaveText("Your plan follows it from now on.", {
        timeout: REPLAN_TIMEOUT_MS,
      });

      await freshRead;

      const isUndo = (request: Request) => {
        const body = request.postData() ?? "";
        return request.method() === "POST" && body.includes(change.id) && body.includes('"undone"');
      };

      const failUndoOnce = async (route: Route) => {
        if (!isUndo(route.request())) {
          await route.continue();
          return;
        }

        await route.abort("failed");
        await page.unroute("**/today", failUndoOnce);
      };

      await page.route("**/today", failUndoOnce);
      const failedUndo = page.waitForEvent("requestfailed", { predicate: isUndo });
      await note.getByRole("button", { name: "Undo" }).click();
      const failed = await failedUndo;
      expect(failed.failure()?.errorText).toContain("ERR_FAILED");

      await expect
        .poll(() => prisma.planChange.findUniqueOrThrow({ where: { id: change.id } }))
        .toMatchObject({ status: "applied" });

      // The failed Undo saved nothing: her applied answer, the error and Undo must stay together.
      await expect(note.getByRole("status")).toHaveText("Your plan follows it from now on.");

      await expect(note.getByText("We couldn't save that. Try again.")).toBeVisible();
      await expect(note.getByRole("button", { name: "Undo" })).toBeVisible();

      await note.getByRole("button", { name: "Undo" }).click();

      await expect
        .poll(() => prisma.planChange.findUniqueOrThrow({ where: { id: change.id } }))
        .toMatchObject({ status: "proposed" });

      await expect
        .poll(() => prisma.goal.findUniqueOrThrow({ where: { id: plan.goalId } }))
        .toMatchObject({ dailyMinutes: original.dailyMinutes });

      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(note.getByText("We couldn't save that. Try again.")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });
});
