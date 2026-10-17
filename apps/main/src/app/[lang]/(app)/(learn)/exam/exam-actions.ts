"use server";

import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { reportExamResult } from "@zoonk/core/exams/results/report";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalIdSchema = z.uuid();
const timeZoneSchema = z.string().refine(isValidTimeZone);

/** "How did it go?": saves the official result. Inputs are untrusted and parsed first. */
export async function reportExamResultAction(
  goalId: unknown,
  input: unknown,
  timeZone: unknown,
): Promise<boolean> {
  const id = goalIdSchema.safeParse(goalId);
  const body = examResultInputSchema.safeParse(input);
  const zone = timeZoneSchema.safeParse(timeZone);

  if (!id.success || !body.success || !zone.success) {
    return false;
  }

  const result = await reportExamResult({ goalId: id.data, input: body.data, timeZone: zone.data });

  if (result.status !== "reported") {
    return false;
  }

  revalidatePath("/[lang]/exam", "page");
  return true;
}
