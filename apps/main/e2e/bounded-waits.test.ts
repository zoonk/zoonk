import { type Route } from "@playwright/test";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { addGradedEssay, addTodayMock } from "./exam-fixtures";
import { type Page, expect, test } from "./fixtures";
import { MODES, asPersona, setDeviceMode } from "./learn-personas";

/**
 * Waits the learner sits through for a request (a grade, a new version, a mock's start) never
 * hang: past their usual time they say they're still working, and past their limit they stop
 * waiting and offer to try again. The requests are held here, like a server that doesn't answer,
 * and the page's clock runs ahead.
 */

/** Holds every Server Action whose body matches, until `release`; later ones go through. */
async function holdServerActions(page: Page, matches: (body: string) => boolean) {
  const held: Route[] = [];
  let holding = true;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const isAction = request.method() === "POST" && request.headers()["next-action"];

    if (holding && isAction && matches(request.postData() ?? "")) {
      held.push(route);
      return;
    }

    await route.fallback();
  });

  return {
    release: async () => {
      holding = false;
      await Promise.all(held.map((route) => route.abort().catch(() => null)));
    },
  };
}

for (const mode of MODES) {
  test.describe(`Bounded waits in ${mode}`, () => {
    test("a typed answer's check says it's still going, then offers to check again", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const answer = "It shows where the electorn is likely to be";

      const [{ lesson }] = await Promise.all([
        playableLessonFixture({ steps: ["typedAnswer", "summary"] }),
        learningProfileFixture({ experienceMode: mode, userId: noProgressUser.id }),
      ]);

      await page.clock.install();
      const check = await holdServerActions(page, (body) => body.includes(answer));
      await setDeviceMode(page.context(), mode);
      await page.goto(`/learn/${lesson.id}`);

      await page
        .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
        .fill(answer);

      await page.getByRole("button", { name: /^Check/u }).click();
      await expect(page.getByRole("button", { name: "Checking your answer" })).toBeDisabled();

      await page.clock.fastForward(16_000);

      await expect(
        page.getByText("Still checking. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(30_000);

      await expect(
        page.getByText("We couldn't check your answer this time. Try again."),
      ).toBeVisible();

      await check.release();
      await page.getByRole("button", { name: /^Check/u }).click();

      await expect(
        page.getByRole("status").filter({ hasText: "Right, watch the spelling" }),
      ).toBeVisible();
    });

    test("a new simpler version that takes too long offers to try again", async ({ page }) => {
      const { lesson } = await playableLessonFixture({ steps: ["explanation", "check"] });
      const answered: Route[] = [];

      // The first request never answers; the next one gets the version.
      await page.route("**/v1/steps/*/variants", async (route) => {
        answered.push(route);

        if (answered.length > 1) {
          await route.fulfill({
            json: {
              content: { text: "Think of a blur instead of a dot.", title: "A blur" },
              id: crypto.randomUUID(),
              kind: "simpler",
              stepId: crypto.randomUUID(),
            },
          });
        }
      });

      await page.clock.install();
      await setDeviceMode(page.context(), mode);
      await page.goto(`/learn/${lesson.id}`);
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      await page.getByRole("button", { name: "Simpler" }).click();
      const simpler = page.getByRole("dialog", { name: "Simpler" });

      await expect(
        simpler.getByRole("progressbar", { name: "Writing this version" }),
      ).toBeVisible();

      await page.clock.fastForward(13_000);

      await expect(
        simpler.getByText("Still writing. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(18_000);
      await expect(simpler.getByText("We couldn't write this version right now.")).toBeVisible();

      await simpler.getByRole("button", { name: "Try again" }).click();
      await expect(simpler.getByText("Think of a blur instead of a dot.")).toBeVisible();
      await answered[0]?.abort().catch(() => null);
    });

    test("a mock's start and hand-in say when they take long, and go through when asked again", async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });
        const start = mode === "fun" ? "I'm in" : "Start the mock exam";

        await page.clock.install();

        const starting = await holdServerActions(
          page,
          (body) => body.includes(mock.blockId) && !body.includes("itemId"),
        );

        await page.goto(`/mock/${mock.blockId}`);
        await page.getByRole("button", { name: start }).click();
        await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();

        await page.clock.fastForward(11_000);

        await expect(
          page.getByText("Still starting. This is taking longer than usual."),
        ).toBeVisible();

        await page.clock.fastForward(35_000);

        await expect(
          page.getByText("That didn't go through. Your answers are saved. Try again in a moment."),
        ).toBeVisible();

        await starting.release();
        await page.getByRole("button", { name: start }).click();
        await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

        // Handing it in (here from the answer sheet) is bounded the same way.
        const handingIn = await holdServerActions(
          page,
          (body) => body.includes(mock.blockId) && !body.includes("itemId"),
        );

        const handIn = async () => {
          await page.getByRole("button", { name: "Answer sheet" }).click();

          await page
            .getByRole("dialog", { name: "Answer sheet" })
            .getByRole("button", { name: "Hand in the mock exam" })
            .click();
        };

        await handIn();
        await expect(page.getByRole("button", { name: "Handing in…" })).toBeDisabled();
        await page.clock.fastForward(11_000);

        await expect(
          page.getByText("Still handing it in. This is taking longer than usual."),
        ).toBeVisible();

        await page.clock.fastForward(35_000);

        await expect(
          page.getByText("That didn't go through. Your answers are saved. Try again in a moment."),
        ).toBeVisible();

        await handingIn.release();
        await handIn();
        await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();
      });
    });

    test("an essay's grade that takes too long keeps the text and offers another try", async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });
        const draft = "Minha segunda versão completa a proposta de intervenção.";

        await page.clock.install();
        await holdServerActions(page, (body) => body.includes(draft));
        await page.goto(`/essay/${essay.blockId}`);

        const rewrite = page.getByLabel("Rewrite what needs work");

        // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
        await expect(async () => {
          await rewrite.fill(draft);
          await expect(rewrite).toHaveValue(draft, { timeout: 1000 });
          await expect(page.getByText("8 words")).toBeVisible({ timeout: 1000 });
        }).toPass();

        await page.getByRole("button", { name: "Send for grading" }).click();
        await expect(page.getByRole("button", { name: "Grading…" })).toBeDisabled();

        await page.clock.fastForward(21_000);

        await expect(
          page.getByText("Still grading. This is taking longer than usual."),
        ).toBeVisible();

        await page.clock.fastForward(70_000);

        await expect(
          page.getByText("That didn't go through. Your text is still here. Try again in a moment."),
        ).toBeVisible();

        await expect(page.getByRole("button", { name: "Send for grading" })).toBeEnabled();
        await expect(rewrite).toHaveValue(draft);
      });
    });
  });
}
