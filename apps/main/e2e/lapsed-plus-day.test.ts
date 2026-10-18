import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { plusCallDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { toUTCMidnight } from "@zoonk/utils/date";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { writeStudyLesson } from "./study-day";

/** Continue's answer names a destination: a page rendered into it would be far larger. */
const MAX_CONTINUE_ANSWER_BYTES = 4096;

/**
 * A language learner on Plus whose day is its phase's call, opened while Plus was active: the
 * saved session holds the call alone. Then Plus ends. The goal's day is the server's UTC day, and
 * the browser is in UTC too, so the day Today shows is the one the plan has.
 */
async function openPlusCallDay(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const day = await plusCallDayFixture({ localDate: toUTCMidnight(new Date()), userId: user.id });
  const free = day.planItems.at(-1);

  // The free lesson after the call is written, so opening it never asks for one.
  await writeStudyLesson(free?.lessonId ?? "");

  const context = await browser.newContext({ storageState: user.storageState, timezoneId: "UTC" });
  const page = await context.newPage();
  const asked: string[] = [];

  await page.route("**/v1/library/lessons/*/generations", async (route) => {
    asked.push(route.request().url());
    await route.abort();
  });

  // Plus is still active: starting the day opens the call's intro, saving the call as its one block.
  await page.goto("/today");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${day.boss.id}\\?session=`, "u"));

  const session = await prisma.studySession.findFirstOrThrow({
    include: { blocks: true },
    where: { userId: user.id },
  });

  expect(session.blocks).toMatchObject([
    { kind: "checkpoint", payload: expect.objectContaining({ planItemId: day.boss.id }) },
  ]);

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  return { asked, free, page, sessionId: session.id, user };
}

test.describe("A Plus day after Plus ends", () => {
  test("the palette's Continue opens the free lesson the day offers instead of the locked call", async ({
    browser,
  }) => {
    const { asked, free, page, sessionId, user } = await openPlusCallDay(browser);

    await page.goto("/today");

    // Once the learner is read (their language's speaking joins the sidebar), the palette opens on
    // all of theirs: one opened before keeps the places every learner has (`learner-frame-paint`).
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await expect(sidebar.getByRole("link", { name: "Speaking" })).toBeVisible();

    const palette = await openPaletteWithKeyboard(page);
    const next = palette.getByRole("option", { name: /^Continue today's session/u });

    // The frame's summary names the free lesson as what's next, never the call.
    await expect(next).toContainText(free?.titleSnapshot ?? "");

    // Continue's answer, read on its way to the page (a navigation drops it from the browser).
    const answers: { bytes: number; revalidated?: string }[] = [];

    await page.route("**/*", async (route) => {
      const request = route.request();

      if (
        request.method() !== "POST" ||
        !request.headers()["next-action"] ||
        !(request.postData() ?? "").includes(sessionId)
      ) {
        await route.fallback();
        return;
      }

      const response = await route.fetch();
      const body = await response.body();

      answers.push({
        bytes: body.byteLength,
        revalidated: response.headers()["x-action-revalidated"],
      });

      await route.fulfill({ body, response });
    });

    await next.click();

    await expect(page).toHaveURL(
      new RegExp(`/learn/${free?.lessonId}\\?session=${sessionId}$`, "u"),
    );

    // It answers with where to go, never the page rendered again in its answer.
    expect(answers).toHaveLength(1);
    expect(answers[0]?.revalidated).toBeUndefined();
    expect(answers[0]?.bytes).toBeLessThan(MAX_CONTINUE_ANSWER_BYTES);

    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );

    expect(asked).toStrictEqual([]);
    await page.context().close();
  });
});
