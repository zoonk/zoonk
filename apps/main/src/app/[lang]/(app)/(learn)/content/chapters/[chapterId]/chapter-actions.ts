"use server";

import { type PracticeBlockResult, openPracticeBlock } from "@/lib/session/open-practice-block";
import { addAreaPracticeBlock } from "@zoonk/core/sessions/area-practice";
import { areaPracticeInputSchema } from "@zoonk/core/sessions/contract";

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
