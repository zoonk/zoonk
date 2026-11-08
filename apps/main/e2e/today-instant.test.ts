import { instant } from "@next/playwright";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * Under `instant()` nothing the server reads at tap time arrives, so a read that drops out of the
 * tab's prefetch leaves Today without the day.
 */
test.describe("Today's instant tab", () => {
  test("a tap on Today shows the learner's day from its prefetch", async ({ browser }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);

    await page.goto("/plan");

    const today = page
      .getByRole("navigation", { name: "Learning tabs" })
      .getByRole("link", { name: /^Today\b/u });

    // A tap before hydration would load the page as a document, which the lock stops at its shell.
    await expectHydrated(today);

    await instant(page, async () => {
      await today.click();
      await expect(page.getByRole("button", { name: /^Start/u })).toBeVisible();
    });

    await expect(page).toHaveURL(/\/today$/u);
  });
});

test.describe("a written lesson's combined start", () => {
  test("paints from its link while start is held, then replaces an alternative opening", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay({ reviewDone: true });
    const page = await openAs(browser, user);
    const sent: string[] = [];
    const release = Promise.withResolvers<null>();

    await page.route("**/api/library/lessons/*/starts", async (route) => {
      sent.push(route.request().postData() ?? "");
      await release.promise;

      await route.fulfill({
        contentType: "application/json",
        json: {
          opening: { blockId: null, kind: "session", sessionId: session.id },
          status: "opened",
        },
      });
    });

    await page.goto("/today");
    const row = page.getByRole("link", { exact: true, name: lesson.title });
    await expectHydrated(row);

    await instant(page, async () => {
      await row.click();
      await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
    });

    await expect.poll(() => sent.length).toBe(1);
    expect(JSON.parse(sent[0] ?? "{}")).toMatchObject({ opening: { target: { kind: "block" } } });
    release.resolve(null);
    await expect(page).toHaveURL(/\/session\?session=/u);
    await page.goBack();
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("a reload sends no start until the first action, then sends the URL's exact opening", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay({ reviewDone: true });
    const page = await openAs(browser, user);
    const sent: unknown[] = [];

    await page.route("**/api/library/lessons/*/starts", async (route) => {
      sent.push(route.request().postDataJSON());

      await route.fulfill({
        json: {
          run: {
            answers: [],
            hyperdrive: { knownStepIds: [], streak: 0 },
            replay: false,
            runId: "289775ed-1f10-4589-9c4d-e429b219deaa",
            sessionId: session.id,
            startedAt: new Date().toISOString(),
          },
          status: "started",
        },
      });
    });

    await page.goto("/today");
    const row = page.getByRole("link", { exact: true, name: lesson.title });
    await expectHydrated(row);
    await row.click();
    await expect.poll(() => sent.length).toBe(1);
    await page.reload();

    const choice = page.getByRole("radio", {
      name: "Where the electron is most likely to be found",
    });

    await expectHydrated(choice);
    expect(sent).toHaveLength(1);
    await choice.click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toMatchObject({ opening: { target: { kind: "block" } } });
    await page.context().close();
  });
});
