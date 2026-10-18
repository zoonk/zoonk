import { writeFile } from "node:fs/promises";
import { type Request } from "@playwright/test";
import { mockConditionsSchema } from "@zoonk/core/exams/mocks/contract";
import { prisma } from "@zoonk/db";
import { answerMockQuestions, createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const MINUTE_MS = 60_000;

/** The mock page's read-only RSC request, never a hand-in Server Action. */
function isMockRead(request: Request): boolean {
  return (
    request.method() === "GET" && request.url().includes("/mock/") && request.headers().rsc === "1"
  );
}

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each; each case owns its browser and persisted learner.
for (const { answerCount, returnByFocus } of [
  { answerCount: 1, returnByFocus: false },
  { answerCount: 5, returnByFocus: false },
  { answerCount: 1, returnByFocus: true },
]) {
  test(`an open tab with ${answerCount} answers refreshes ${returnByFocus ? "on return" : "after the deadline"} without scoring`, async ({
    browser,
  }, testInfo) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);

    try {
      await page.clock.install();
      await page.goto("/mock/new");

      await page
        .getByRole("radiogroup", { name: "One subject" })
        .getByText("Mathematics", { exact: true })
        .click();

      await page.getByRole("button", { exact: true, name: "Start" }).click();
      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
      await answerMockQuestions({ answers, count: answerCount, knows: () => true, page });

      await expect
        .poll(async () => {
          const saved = await prisma.mockExamAnswer.findMany({
            where: { mockExam: { userId: user.id } },
          });

          return saved.filter((answer) => answer.answer !== null).length;
        })
        .toBe(answerCount);

      const sitting = await prisma.mockExam.findFirstOrThrow({
        include: { answers: true },
        where: { userId: user.id },
      });

      const conditions = mockConditionsSchema.parse(sitting.conditions);
      const minutes = conditions.sections[sitting.sectionIndex]?.minutes ?? 0;
      const reads: string[] = [];
      const refreshResponse = page.waitForResponse((response) => isMockRead(response.request()));
      const writes: string[] = [];

      page.on("request", (request) => {
        if (isMockRead(request)) {
          reads.push(request.url());
        }
      });

      await page.route("**/*", async (route) => {
        const request = route.request();

        if (
          request.method() === "POST" &&
          request.headers()["next-action"] &&
          !(request.postData() ?? "").includes('"itemId"')
        ) {
          writes.push(request.postData() ?? "");
          await route.abort();
          return;
        }

        await route.fallback();
      });

      if (returnByFocus) {
        await page.clock.fastForward((minutes + 1) * MINUTE_MS);
        await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
        const now = await page.evaluate(() => Date.now());

        await test.step("pause the open timeout screen", () =>
          page.clock.pauseAt(new Date(now + 1000)));
      }

      // Ana returns to her still-open tab after its deadline and the abandonment threshold. The
      // server clock is real, so move only this test's sitting back as the browser clock moves on.
      await prisma.mockExam.update({
        data: { sectionStartedAt: new Date(Date.now() - (minutes + 11) * MINUTE_MS) },
        where: { id: sitting.id },
      });

      if (returnByFocus) {
        const now = await page.evaluate(() => Date.now());

        await test.step("move past grace without firing timers", () =>
          page.clock.setSystemTime(new Date(now + 11 * MINUTE_MS)));

        await page.evaluate(() => {
          document.documentElement.dataset.returnEvents = "";

          window.addEventListener("focus", () => {
            document.documentElement.dataset.returnEvents += `focus:${document.visibilityState};`;
          });

          document.addEventListener("visibilitychange", () => {
            document.documentElement.dataset.returnEvents += `visibility:${document.visibilityState};`;
          });
        });

        const otherTab = await test.step("open another tab", () => page.context().newPage());
        await test.step("leave the mock tab", () => otherTab.bringToFront());
        await test.step("return to the mock tab", () => page.bringToFront());
        await test.step("close the other tab", () => otherTab.close());
        await test.step("resume browser scheduling", () => page.clock.resume());

        const eventLog = testInfo.outputPath("tab-return-events.txt");

        const events = await page.evaluate(() => ({
          delivered: document.documentElement.dataset.returnEvents ?? "",
          visibility: document.visibilityState,
        }));

        await writeFile(eventLog, JSON.stringify(events));
        await testInfo.attach("tab-return-events", { contentType: "text/plain", path: eventLog });
        // Headless Chromium has no OS window focus. Exercise the browser focus event after
        // returning the real tab; the request, server-derived status and screen remain real.
        await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
        await page.evaluate(() => globalThis.dispatchEvent(new Event("focus")));
      } else {
        await page.clock.fastForward((minutes + 11) * MINUTE_MS);
      }

      // Core decides whether the answered share expires this sitting. A mostly answered mock
      // remains ready to hand in, keeping its current drafts through the same read-only refresh.
      const refreshed = await test.step("observe the read-only refresh", () => refreshResponse);
      expect(refreshed.ok()).toBe(true);
      await expect.poll(() => reads.length).toBeGreaterThan(0);

      if (answerCount < 4) {
        const restart = page.getByRole("link").filter({ hasNotText: "Leave" });
        await expect(restart).toHaveAttribute("href", /\/mock\/new$/u);
        await expect(page.getByRole("heading", { name: "Time's up" })).toBeHidden();
        await expect(page.getByRole("button", { name: "See how it went" })).toBeHidden();
      } else {
        await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
        await expect(page.getByRole("button", { name: "See how it went" })).toBeVisible();
        await page.clock.fastForward(MINUTE_MS);
        expect(reads).toHaveLength(1);
        const saved = await prisma.mockExamAnswer.findMany({ where: { mockExamId: sitting.id } });

        expect(saved.map((draft) => draft.answer)).toEqual(
          expect.arrayContaining(sitting.answers.map((draft) => draft.answer)),
        );
      }

      expect(writes).toHaveLength(0);

      await expect(
        Promise.all([
          prisma.attempt.count({ where: { mockExamId: sitting.id } }),
          prisma.learningEvent.count({ where: { kind: "mock", userId: user.id } }),
          prisma.mockExam.findUniqueOrThrow({ where: { id: sitting.id } }),
        ]),
      ).resolves.toMatchObject([0, 0, { result: null, status: "active" }]);
    } finally {
      // Cleanup must not replace the original failure after Playwright closes a timed-out context.
      await page
        .context()
        .close()
        .catch(() => {});
    }
  });
}
