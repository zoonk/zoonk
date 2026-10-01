import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import {
  CHECKPOINT_PASS_MARK,
  CHECKPOINT_QUESTIONS,
  MOCK_MINUTES,
  createCheckpointLearner,
  playDuel,
  starShownAt,
} from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

async function planItemStatus(id: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id } });
  return item.status;
}

test.describe("Checkpoints", () => {
  test("Fun: winning the Trickster duel checks the phase off, with a calm fade under reduced motion", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/checkpoint/${block.id}`);

    await expect(page.getByRole("heading", { level: 1, name: "The Trickster" })).toBeVisible();

    await expect(
      page.getByText(
        `${CHECKPOINT_QUESTIONS} mixed questions, no hints. Get ${CHECKPOINT_PASS_MARK} right to win.`,
      ),
    ).toBeVisible();

    await expect(page.getByText("Trap hunter badge")).toBeVisible();
    await expect(page.getByRole("meter", { name: "Shield" })).toHaveAttribute("aria-valuenow", "0");
    await expectAccessibleScreen(page, "the boss's intro");

    await page.getByRole("button", { name: "Take it on" }).click();
    await expect(page.getByText("No hints")).toBeVisible();

    await playDuel(page);

    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} of ${CHECKPOINT_QUESTIONS} right`),
    ).toBeVisible();

    await expect(page.getByText("Phase 1 complete")).toBeVisible();

    // Reduced motion swaps the celebration for a calm fade.
    const buddy = page.getByRole("img", { name: "Zu" });
    await expect(buddy).toBeVisible();

    await expect
      .poll(() => buddy.evaluate((element) => getComputedStyle(element).animationName))
      .toBe("fun-fade-in");

    await page.getByText("Review the answers").click();
    await expect(page.getByText("It follows the rule.")).toHaveCount(CHECKPOINT_QUESTIONS);

    await expect.poll(() => planItemStatus(boss.id)).toBe("done");

    // Opened on its own rather than from today's session, it continues to Today.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/today");
    await page.context().close();
  });

  test("Fun: losing costs nothing, with a rematch tomorrow and the next phase open", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await page.goto(`/checkpoint/${block.id}`);
    await page.getByRole("button", { name: "Take it on" }).click();
    await playDuel(page, { answer: "Wrong answer" });

    await expect(page.getByRole("heading", { name: "Good fight!" })).toBeVisible();
    await expect(page.getByText("Rematch tomorrow")).toBeVisible();
    await expect(page.getByText("Practice is open")).toBeVisible();
    await expect(page.getByText("Trap hunter badge")).toHaveCount(0);

    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    await page.context().close();
  });

  test("Fun: the Big Challenge rehearses exam day with a checklist", async ({ browser }) => {
    const { block, user } = await createCheckpointLearner({ kind: "weekly", mode: "fun" });
    const page = await openAs(browser, user);

    // A weekly mock runs in real conditions on its own screen.
    await page.goto(`/checkpoint/${block.id}`);
    await expect(page).toHaveURL(new RegExp(`/mock/${block.id}$`, "u"));

    await expect(page.getByRole("heading", { level: 1, name: "Big Challenge" })).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} questions · ${MOCK_MINUTES} min`),
    ).toBeVisible();

    await expect(page.getByText("0 of 4")).toBeVisible();
    await expectAccessibleScreen(page, "the Big Challenge");

    const phone = page.getByRole("button", { name: "Phone on silent" });
    await phone.click();

    await expect(phone).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 of 4")).toBeVisible();

    // From here it plays as any mock exam does (see the exam goal's mock).
    await page.getByRole("button", { name: "I'm in" }).click();

    await expect(
      page.getByText(new RegExp(`^Question 1 of ${CHECKPOINT_QUESTIONS}`, "u")),
    ).toBeVisible();

    await page.context().close();
  });
});

test.describe("A checkpoint from today's session in Fun", () => {
  test("continues back to the session by keyboard, where the first boss's glasses go on", async ({
    browser,
  }) => {
    const { block, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Keys work once the page hydrates, so each first press retries until the screen changes.
    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"), {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });

    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(page.getByText(`Question 1 of ${CHECKPOINT_QUESTIONS}`)).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 5000 });

    await playDuel(page, { keyboard: true });

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");

    await page.keyboard.press("Enter");

    // The checkpoint was the day's only block, so the session shows the day's summary.
    await expect(page).toHaveURL(/\/session$/u);

    // In Fun, the first boss won brings glasses first. Enter presses the focused "Wear them"; the
    // summary under the ceremony keeps its own Enter for later.
    const wear = page.getByRole("button", { name: "Wear them" });
    await expect(wear).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(wear).toBeHidden();
    await expect(page).toHaveURL(/\/session$/u);

    // "Wear them" puts the new glasses on the buddy and marks the ceremony shown.
    await expect
      .poll(async () => {
        const profile = await prisma.userLearningProfile.findUnique({ where: { userId: user.id } });
        return profile?.buddyGlasses;
      })
      .toBe("star");

    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    await expect(
      page.getByRole("heading", { level: 1, name: "Flight plan complete!" }),
    ).toBeVisible();

    await page.context().close();
  });
});

/** The week's challenges of a plan, as learner-local days. */
async function challengeDays(planId: string) {
  const items = await prisma.planItem.findMany({
    where: { kind: { in: ["checkpoint", "mock"] }, planId, status: "todo" },
  });

  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10));
}

async function blockStatus(blockId: string) {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  return block.status;
}

test.describe("Move to Monday", () => {
  test("the week's challenge moves to Monday through the plan, with undo", async ({ browser }) => {
    const { block, plan, user } = await createCheckpointLearner({
      kind: "weekly",
      mode: "focus",
      planned: true,
    });

    const page = await openAs(browser, user);

    await page.goto(`/checkpoint/${block.id}`);
    const move = page.getByRole("button", { name: "Move to Monday" });
    await expect(move).toBeVisible();
    await expectAccessibleScreen(page, "the week's challenge");
    await move.click();

    await expect(page.getByRole("heading", { name: /^Moved to/u })).toBeVisible();
    await expect(page.getByText("Your plan made room for it. Nothing is lost.")).toBeVisible();
    await expect.poll(() => blockStatus(block.id)).toBe("skipped");

    const days = await challengeDays(plan.id);
    expect(days.some((day) => day && new Date(`${day}T00:00:00Z`).getUTCDay() === 1)).toBe(true);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(page.getByRole("button", { name: "Move to Monday" })).toBeVisible();
    await expect.poll(() => blockStatus(block.id)).toBe("pending");

    await page.context().close();
  });
});
