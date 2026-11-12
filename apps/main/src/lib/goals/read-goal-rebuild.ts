"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import {
  type GoalContentCountry,
  goalContentCountrySchema,
} from "@zoonk/core/goals/country-contract";
import { z } from "zod";

const goalRebuildSchema = z.object({
  contentCountry: goalContentCountrySchema.pick({ rebuild: true }).nullable(),
});

/** The goal's own rebuild state, the one Apple and Android follow. Null when it couldn't be read. */
export async function readGoalRebuild(
  goalId: string,
): Promise<GoalContentCountry["rebuild"] | null> {
  const response = await getFromBrowser(`/v1/goals/${encodeURIComponent(goalId)}`);

  if (!response?.ok) {
    return null;
  }

  const parsed = goalRebuildSchema.safeParse(await response.json().catch(() => null));

  if (!parsed.success) {
    return null;
  }

  return parsed.data.contentCountry?.rebuild ?? "none";
}
