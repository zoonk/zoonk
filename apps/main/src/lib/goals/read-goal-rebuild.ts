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

/** The goal's own rebuild state, the one Apple and Android follow. Throws when it can't be read. */
export async function readGoalRebuild(goalId: string): Promise<GoalContentCountry["rebuild"]> {
  const response = await getFromBrowser(`/v1/goals/${encodeURIComponent(goalId)}`);

  if (!response?.ok) {
    throw new Error(`Couldn't read goal ${goalId}: ${response?.status ?? "no response"}`);
  }

  const body: unknown = await response.json();
  return goalRebuildSchema.parse(body).contentCountry?.rebuild ?? "none";
}
