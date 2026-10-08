import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";

/**
 * Plays a challenge lesson (the A/B test case from `challengeCaseFixture`) from the learner's plan:
 * the intro with the team kept with the plan, decisions picked with number keys or taps and sent
 * with Confirm, the meters and the week that passes, the ending and the debrief, then the lesson's
 * completion. A weak ending's debrief is the player's to test (`packages/player`).
 */

/** A learner whose plan has the challenge lesson, which keeps its team once it first opens. */
async function openChallenge(page: Page, userId: string) {
  const [{ lesson }, goal] = await Promise.all([
    playableLessonFixture({ lesson: { title: "Challenge: A/B tests" }, steps: ["challenge"] }),
    goalFixture({ userId }),
  ]);

  const plan = await planFixture({ goalId: goal.id });
  await planItemFixture({ lessonId: lesson.id, planId: plan.id });
  await page.goto(`/learn/${lesson.id}`);

  return { planId: plan.id };
}

/** The team the plan keeps once the first challenge opens, in order: data, then product. */
async function readTeam(planId: string): Promise<string[]> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const settings = plan.settings as { team?: { members: { name: string }[] } };

  return settings.team?.members.map((member) => member.name) ?? [];
}

function primary(page: Page, name: RegExp) {
  return page.getByRole("button", { name });
}

async function startCase(page: Page, planId: string) {
  await expect(page.getByText("Challenge · Day 3 at Aurora Shop")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Does button B sell more?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your mission" })).toBeVisible();

  const [data = "", product = ""] = await readTeam(planId);

  const team = page.locator('[data-slot="challenge-team"]');
  await expect(team).toContainText(`${data}Data scientist`);
  await expect(team).toContainText(`${product}Product manager`);
  await expect(team).toContainText("AI assistant");
  await expect(page.getByText(`Meeting with ${product} today at 3 pm`)).toBeVisible();

  // Enter's listener attaches as the page hydrates, so the first press retries.
  await expect(async () => {
    await page.keyboard.press("Enter");

    await expect(page.getByText("B won! 3.4% vs. 3.1%. Can I launch it today?")).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 5000 });

  return { product };
}

async function playStrongPath(page: Page, product: string) {
  // Number keys pick; Confirm stays off until something is picked.
  await expect(primary(page, /^Confirm/u)).toBeDisabled();
  await page.keyboard.press("3");
  await expect(page.getByRole("radio", { name: /Ask the AI to check/u })).toBeChecked();
  await page.keyboard.press("Enter");

  await expect(page.getByText(/could be pure chance \(p ≈ 0\.6\)/u)).toBeVisible();

  const meters = page.locator('[data-slot="challenge-meters"]');
  await expect(meters).toContainText("Risk of a wrong call");
  await expect(meters).toContainText("much lower");
  await expect(meters).toContainText(`${product}'s patience`);

  await expect(page.getByRole("heading", { name: `What do you tell ${product}?` })).toBeVisible();
  await page.getByRole("radio", { name: /A gap this small shows up by chance/u }).click();
  await primary(page, /^Confirm/u).click();

  await expect(page.getByText("One week later")).toBeVisible();
  await expect(page.getByText("9,800 visits per version · 8 days of testing")).toBeVisible();

  await page.keyboard.press("1");
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Version B went to everyone: 3.1% → 3.7%", { exact: false }),
  ).toBeVisible();
}

test.describe("Challenge lesson", () => {
  test("solves the case like at work and gets a debrief", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { planId } = await openChallenge(page, noProgressUser.id);
    const { product } = await startCase(page, planId);

    await playStrongPath(page, product);

    await primary(page, /^See how it went/u).click();
    await expect(page.getByRole("heading", { name: "Challenge complete" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nicely done" })).toBeVisible();

    await expect(
      page.getByText("You checked whether the gap could be chance before deciding."),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "To improve" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Skills practiced" })).toBeVisible();

    await primary(page, /^Continue/u).click();
    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // Opening it again keeps the same people.
    await expect(readTeam(planId)).resolves.toHaveLength(4);
  });
});
