import { type Page } from "@playwright/test";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

/** What a test says the search found: the goal's date and whatever it found by it. */
type FoundTime = Partial<PlanTimeToCover> & Pick<PlanTimeToCover, "targetDate">;

/**
 * "Find the time that covers everything" (and Move your date without an answer yet) posts from the
 * browser to the API: each test says what the search found. The API's E2E and core's tests prove
 * the search exact; these test what the screens do around it.
 */
export async function routeTimeToCover(
  page: Page,
  { goalId, time }: { goalId: string; time: FoundTime },
) {
  await page.route(`**/v1/goals/${goalId}/plan/time-to-cover`, async (route) => {
    const json: PlanTimeToCover = {
      coreMinutes: null,
      fittingDate: null,
      readingNotice: false,
      ready: true,
      recommendedMinutes: null,
      targetDateNamedMonth: false,
      ...time,
    };

    await route.fulfill({ json });
  });
}
