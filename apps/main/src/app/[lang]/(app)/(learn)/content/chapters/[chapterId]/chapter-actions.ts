"use server";

import { type PracticeBlockResult, openPracticeBlock } from "@/lib/session/open-practice-block";
import { addAreaPracticeBlock } from "@zoonk/core/sessions/area-practice";
import { areaPracticeInputSchema } from "@zoonk/core/sessions/contract";

/**
 * A chapter's "Practice": core adds a bonus block on the chapter's skills to today's session, then
 * it starts where it's played. The same capability as `POST /v1/goals/{goalId}/area-practice`.
 */
export async function practiceAreaAction(
  goalId: string,
  input: { areaId: string; timeZone: string },
): Promise<PracticeBlockResult> {
  const parsed = areaPracticeInputSchema.safeParse(input);

  if (!parsed.success) {
    return { outcome: "failed" };
  }

  return openPracticeBlock({
    add: () => addAreaPracticeBlock({ goalId, input: parsed.data }),
    label: "practiceAreaAction",
    timeZone: input.timeZone,
  });
}
