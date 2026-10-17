import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

test.describe("Today without a connection", () => {
  // A phone that lost its connection on the bus pressed Enter: the request never got an answer,
  // and Today gave way to "This page didn't load… on our side", queue, week and all.
  test("keeps the step when opening it fails, says so and opens it on the next try", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();
    const page = await openAs(browser, user);
    let offline = true;

    // Only the request that opens the session's next step fails (it names the session), so the
    // time zone Today checks on opening still goes through.
    await page.route("**/*", async (route) => {
      const request = route.request();

      const opensNextStep =
        request.method() === "POST" &&
        Boolean(request.headers()["next-action"]) &&
        Boolean(request.postData()?.includes(session.id));

      if (offline && opensNextStep) {
        await route.abort("internetdisconnected");
        return;
      }

      await route.fallback();
    });

    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();

    // The step opens on the session screen at once; the try that fails says so there, inline.
    const main = page.getByRole("main");
    const start = main.getByRole("button", { exact: true, name: "Start" });
    const failure = main.getByRole("alert");

    // Enter is listened for once Today is interactive, so it's pressed until the try fails.
    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(failure).toHaveText("We couldn't open this step. Try again.", { timeout: 1000 });
    }).toPass();

    await expect(start).toBeEnabled();
    await expect(page).toHaveURL(/\/session\?block=[\w-]+$/u);
    await expect(page.getByRole("heading", { name: "This page didn't load" })).toHaveCount(0);

    // The next tap opens it: the review's questions replace Start.
    offline = false;
    await start.click();
    await expect(page.getByRole("link", { name: "Close. Your answers are saved." })).toBeVisible();

    await page.context().close();
  });
});
