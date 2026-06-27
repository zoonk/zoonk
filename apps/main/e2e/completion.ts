import { type Locator } from "@playwright/test";
import { type Page, expect } from "./fixtures";

const MAX_COMPLETION_PROGRESS_MILESTONES = 10;

/**
 * Completion can show progress milestones before the ordinary summary with
 * navigation links. App e2e specs usually care about the final lesson,
 * chapter, or course action, so this helper advances through any milestone
 * screens without tying the tests to a specific user-progress threshold.
 */
export async function advanceToCompletionSummary({
  page,
  steps = 0,
}: {
  page: Page;
  steps?: number;
}) {
  const completionScreen = page.getByRole("status");

  await expect(completionScreen).toBeVisible();

  if (await getCompletionSummaryAction(completionScreen).isVisible()) {
    return;
  }

  if (steps >= MAX_COMPLETION_PROGRESS_MILESTONES) {
    await expect(getCompletionSummaryAction(completionScreen)).toBeVisible();
    return;
  }

  const continueButton = completionScreen.getByRole("button", { name: /^continue$/iu });

  if (await continueButton.isVisible()) {
    await continueButton.click();
    await advanceToCompletionSummary({ page, steps: steps + 1 });
    return;
  }

  await expect(getCompletionSummaryAction(completionScreen)).toBeVisible();
}

/**
 * The ordinary completion summary always exposes at least one navigation link.
 * Progress milestone screens can expose "Learn about..." links too, so this
 * sentinel intentionally matches only the summary actions.
 */
function getCompletionSummaryAction(completionScreen: Locator) {
  return completionScreen
    .getByRole("link", {
      name: /^(?<summaryAction>exit|next|next chapter|review chapter|review course)$/iu,
    })
    .first();
}
