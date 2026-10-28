import { type Page } from "@playwright/test";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

type FoundTime = Partial<PlanTimeToCover> & Pick<PlanTimeToCover, "targetDate">;

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
