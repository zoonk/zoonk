import { type Page, type Request, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { readDayNames } from "./study-day";

/** What the plan-edit model said of the learner's words, stored with the change. */
const PROPOSAL = "Twenty-five minutes a day keeps your plan on track for the exam.";

/** Where the browser reads Today's view again, instead of rendering the page again. */
const TODAY_VIEW_PATH = "/api/learner/views/today";

/**
 * The answer to the learner's undo (a Server Action naming the change), then the response to the
 * first Today view read sent after it, as against one the page sent before the answer.
 */
function watchUndo(page: Page, changeId: string) {
  const viewed = Promise.withResolvers<null>();
  let hasAnswered = false;
  let viewRead: Request | null = null;

  page.on("request", (request) => {
    if (hasAnswered && viewRead === null && new URL(request.url()).pathname === TODAY_VIEW_PATH) {
      viewRead = request;
    }
  });

  page.on("response", (response) => {
    const request = response.request();

    if (request.method() === "POST" && (request.postData() ?? "").includes(changeId)) {
      hasAnswered = true;
    } else if (request === viewRead) {
      viewed.resolve(null);
    }
  });

  return viewed.promise;
}

test.describe("Undoing a plan change on Today", () => {
  // Ana applied a suggestion on Today and undid it: her plan was back as it was, but Today kept
  // showing the day Apply had built, until she reloaded. The undo's answer makes Today read its
  // view again, so the day she had comes back on its own.
  test("reads Today again once the undo is saved, so the day shows as it was", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      await page.goto("/today");
      const day = page.getByRole("region", { name: "Today's session" }).getByRole("listitem");
      await expect(day.first()).toBeVisible();
      const names = await readDayNames(day);

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 90 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.reload();
      const note = page.getByRole("region", { name: "Suggested change" });
      await note.getByRole("button", { name: "Apply" }).click();

      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
        { timeout: REPLAN_TIMEOUT_MS },
      );

      await expect.poll(() => readDayNames(day)).not.toStrictEqual(names);

      const viewed = watchUndo(page, change.id);
      await note.getByRole("button", { name: "Undo" }).click();
      await viewed;

      await expect.poll(() => readDayNames(day)).toStrictEqual(names);
    });
  });

  test("keeps the applied confirmation and Undo retry when Undo cannot save", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, original] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      // Only this proposal waits, so the fresh view has no change once Apply saves it.
      await prisma.planChange.updateMany({
        data: { status: "declined" },
        where: { planId: plan.id, status: "proposed" },
      });

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 90 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

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

      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
        { timeout: REPLAN_TIMEOUT_MS },
      );

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
      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
      );

      await expect(note.getByText("We couldn't save that. Try again.")).toBeVisible();
      await expect(note.getByRole("button", { name: "Undo" })).toBeVisible();

      await note.getByRole("button", { name: "Undo" }).click();

      await expect
        .poll(() => prisma.planChange.findUniqueOrThrow({ where: { id: change.id } }))
        .toMatchObject({ status: "proposed" });

      await expect
        .poll(() => prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }))
        .toMatchObject({ dailyMinutes: original.dailyMinutes });

      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(note.getByText("We couldn't save that. Try again.")).toHaveCount(0);
    });
  });
});
