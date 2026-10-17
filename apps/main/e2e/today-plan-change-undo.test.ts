import { type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
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
      );

      await expect.poll(() => readDayNames(day)).not.toStrictEqual(names);

      const viewed = watchUndo(page, change.id);
      await note.getByRole("button", { name: "Undo" }).click();
      await viewed;

      await expect.poll(() => readDayNames(day)).toStrictEqual(names);
    });
  });
});
