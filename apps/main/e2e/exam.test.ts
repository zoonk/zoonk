import { type Request, type Route } from "@playwright/test";
import { addTodayMock, playMock } from "./exam-fixtures";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const NOT_THROUGH = "That didn't go through. Your answers are saved. Try again in a moment.";

async function holdPosts(page: Page, matches: (request: Request) => boolean) {
  const held: Route[] = [];
  const { promise: intercepted, resolve } = Promise.withResolvers<Request>();
  let holding = true;

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (holding && request.method() === "POST" && matches(request)) {
      held.push(route);
      resolve(request);
      return;
    }

    await route.fallback();
  });

  return {
    intercepted,
    release: async () => {
      holding = false;
      await Promise.all(held.map((route) => route.abort().catch(() => null)));
    },
    stopHolding: () => {
      holding = false;
    },
  };
}

function holdServerActions(page: Page, matches: (body: string) => boolean) {
  return holdPosts(
    page,
    (request) => Boolean(request.headers()["next-action"]) && matches(request.postData() ?? ""),
  );
}

test.describe("Exam goal", () => {
  test("a mock in real conditions, its start and hand-in waits bounded, and its result", async ({
    browser,
  }) => {
    test.slow();

    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });

      const isStart = (body: string) => body.includes(mock.planItemId);

      const isHandIn = (body: string) => body.includes(mock.blockId) && !body.includes("itemId");

      await page.clock.install();
      const starting = await holdServerActions(page, isStart);

      await page.goto(`/mock/${mock.blockId}`);
      await expect(page).toHaveURL(new RegExp(`/challenge/${mock.planItemId}$`, "u"));

      const start = page.getByRole("button", { exact: true, name: "Start" });
      await start.click();
      await expect(start).toHaveAttribute("aria-busy", "true");
      await expect(start).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still starting. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();

      await starting.release();
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/mock/${mock.blockId}$`, "u"));
      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

      const handingIn = await holdServerActions(page, isHandIn);
      await playMock({ answers: mock.answers, page });

      const handIn = page
        .getByRole("complementary", { name: "Answer sheet" })
        .getByRole("button", { name: "Hand in" });

      await expect(handIn).toBeDisabled();
      await handingIn.intercepted;
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still handing it in. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText(NOT_THROUGH)).toBeVisible();

      await handingIn.release();

      await handIn.click();

      await page
        .getByRole("alertdialog", { name: "Hand in the mock exam?" })
        .getByRole("button", { name: "Hand in" })
        .click();

      await expect(
        page.getByRole("heading", { level: 1, name: /^Mock exam 2\s*\d+–\d+$/u }),
      ).toBeVisible();

      const review = page.getByRole("region", { name: "Questions to review" });

      await expect(
        review.getByRole("button", { name: /Question 1\b.+Wrong.+Not sure$/u }),
      ).toBeVisible();

      await expect(
        review.getByRole("button", { name: /Question 2\b.+Right.+Not sure$/u }),
      ).toBeVisible();
    });
  });

  test("a learner with one finished mock exam sees its score on the exam page", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.goto("/exam");

      await expect(
        page
          .getByRole("region", { name: "Your progress" })
          .getByText(/^\d+%\s*Right answers in Mock exam 1$/u),
      ).toBeVisible();
    });
  });
});
