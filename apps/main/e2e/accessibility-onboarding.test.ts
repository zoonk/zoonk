import { randomUUID } from "node:crypto";
import { ACCESSIBILITY_VIEWPORTS, scanCurrentScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { MODES, setDeviceMode } from "./learn-personas";
import { createMappedGoal } from "./onboarding-fixtures";

/**
 * Onboarding played mostly by keyboard, from a typed goal to the plan, with an accessibility scan
 * (light and dark) of every screen: the goal, what was understood, each question, the mode and the
 * buddy, placement and the plan. Both modes, phone and desktop widths; Fun screens, which are dark
 * only, are scanned on a light device and checked to stay dark.
 */

const SCAN_TIMEOUT_MS = 240_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

type Scan = (label: string) => Promise<void>;

function scanner(page: Page, violations: string[]): Scan {
  return async (label) => {
    violations.push(...(await scanCurrentScreen(page, label)));
  };
}

/**
 * Waits for the question, answers it, scans it as it looks right before continuing (Continue
 * enabled, so the last answer finished saving), then moves on with Continue.
 */
async function answer(
  page: Page,
  { choose, heading, scan }: { choose?: () => Promise<void>; heading: string; scan: Scan },
) {
  const next = page.getByRole("button", { exact: true, name: "Continue" });

  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await choose?.();
  await expect(next).toBeEnabled();
  await scan(heading);
  await tabTo(page, next);
  await page.keyboard.press("Enter");
}

async function typeGoal(page: Page, scan: Scan) {
  const goal = `i want to understand quantum physics ${randomUUID().slice(0, 8)}`;

  await goalUnderstandingFixture({
    goal,
    result: {
      followUps: [],
      goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
      route: "goals",
    },
  });

  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await scan("the goal");

  await tabTo(page, page.getByRole("textbox", { name: "Your goal" }));
  await page.keyboard.type(goal);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await scan("what was understood");
  await tabTo(page, page.getByRole("button", { name: "Looks right" }));
  await page.keyboard.press("Enter");
}

async function answerQuestions(page: Page, scan: Scan) {
  const purpose = "What do you want from it?";
  await expect(page.getByRole("heading", { name: purpose })).toBeVisible();
  await scan(purpose);
  await page.keyboard.press("1");
  await page.keyboard.press("Enter");

  const date = "Is there a date you're aiming for?";
  await expect(page.getByRole("heading", { name: date })).toBeVisible();
  await scan(date);
  await tabTo(page, page.getByRole("button", { name: "No date" }));
  await page.keyboard.press("Enter");

  await answer(page, {
    choose: () => page.getByText("The basics").click(),
    heading: "How much do you already know?",
    scan,
  });

  await answer(page, {
    choose: () => page.getByText("30 min", { exact: true }).click(),
    heading: "How much time can you study each day?",
    scan,
  });

  await answer(page, {
    choose: async () => {
      await page.getByLabel("Month").selectOption("3");
      await page.getByLabel("Year").selectOption("1995");
    },
    heading: "When were you born?",
    scan,
  });
}

for (const mode of MODES) {
  test.describe(`Accessibility of onboarding by keyboard in ${mode}`, () => {
    for (const viewport of ACCESSIBILITY_VIEWPORTS) {
      test(`onboarding is accessible in ${mode} on ${viewport.name}`, async ({ page }) => {
        const violations: string[] = [];
        const scan = scanner(page, violations);

        await setDeviceMode(page.context(), mode);
        await page.setViewportSize(viewport.size);

        await typeGoal(page, scan);
        await answerQuestions(page, scan);
        await answer(page, { heading: "How do you like to study?", scan });

        if (mode === "fun") {
          await answer(page, {
            choose: () => page.getByRole("radio", { name: /Otto/u }).click(),
            heading: "Choose your buddy",
            scan,
          });
        }

        await expect(
          page.getByRole("heading", { name: "Let's see what you already know" }),
        ).toBeVisible();

        await scan("placement's start");
        await tabTo(page, page.getByRole("button", { name: "I'd rather start from scratch" }));
        await page.keyboard.press("Enter");

        await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
        await scan("the plan being built");
        expect(violations, violations.join("\n")).toEqual([]);
      });

      test(`placement and the plan are accessible in ${mode} on ${viewport.name}`, async ({
        noProgressUser,
        userWithoutProgress: page,
      }) => {
        const violations: string[] = [];
        const scan = scanner(page, violations);
        const goal = await createMappedGoal(noProgressUser.id);

        await setDeviceMode(page.context(), mode);
        await page.setViewportSize(viewport.size);
        await page.goto(`/start/${goal.id}`);

        await expect(
          page.getByRole("heading", { name: "Let's see what you already know" }),
        ).toBeVisible();

        await tabTo(page, page.getByRole("button", { exact: true, name: "Start" }));
        await page.keyboard.press("Enter");

        await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
        await scan("a placement question");
        await page.keyboard.press("1");
        await page.keyboard.press("Enter");

        await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
        await tabTo(page, page.getByRole("button", { name: "Stop here and see my plan" }));
        await page.keyboard.press("Enter");

        await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();
        await scan("the plan");
        expect(violations, violations.join("\n")).toEqual([]);
      });
    }
  });
}
