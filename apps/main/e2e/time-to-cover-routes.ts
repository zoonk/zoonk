import { type Page } from "@playwright/test";
import { type PlanBasesAdvice } from "@zoonk/core/plans/bases-advice-contract";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { z } from "zod";

/** What a test says the search found: the goal's date and whatever it found by it. */
type FoundTime = Partial<PlanTimeToCover> & Pick<PlanTimeToCover, "targetDate">;

/** The week the browser asked about (see `PlanTimeToCoverInput`). */
const askedWeekSchema = z.object({
  studyDays: z.array(z.int()).optional(),
  weekendMinutes: z.int().optional(),
});

type AskedWeek = z.infer<typeof askedWeekSchema>;

/**
 * "Find the time that covers everything" (and Move your date without an answer yet) posts from the
 * browser to the API: each test says what the search found. The API's
 * E2E and core's tests prove the search exact; these test what the screens do around it. `time`
 * can answer each week asked about, and take its time (a big plan's search takes seconds).
 * Resolves to the weeks the browser asked about, in order.
 */
export async function routeTimeToCover(
  page: Page,
  {
    goalId,
    time,
  }: { goalId: string; time: FoundTime | ((week: AskedWeek) => FoundTime | Promise<FoundTime>) },
): Promise<AskedWeek[]> {
  const asked: AskedWeek[] = [];

  await page.route(`**/v1/goals/${goalId}/plan/time-to-cover`, async (route) => {
    const body: unknown = route.request().postDataJSON();
    const week = askedWeekSchema.parse(body ?? {});
    asked.push(week);
    const found = typeof time === "function" ? await time(week) : time;

    const json: PlanTimeToCover = {
      coreMinutes: null,
      fittingDate: null,
      readingNotice: false,
      ready: true,
      recommendedMinutes: null,
      targetDateNamedMonth: false,
      ...found,
    };

    await route.fulfill({ json });
  });

  return asked;
}

/** What the app recommends for the plan's bases when the learner asks (see `routeTimeToCover`). */
export async function routeBasesAdvice(
  page: Page,
  { advice, goalId }: { advice: PlanBasesAdvice; goalId: string },
): Promise<unknown[]> {
  const asked: unknown[] = [];

  await page.route(`**/v1/goals/${goalId}/plan/bases-advice`, async (route) => {
    asked.push(route.request().method());
    await route.fulfill({ json: advice });
  });

  return asked;
}
