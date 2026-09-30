import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { ownLevelSchema } from "../learner/placement/placement-contract";
import { type PlanChangeView } from "./plan-view-contract";

/** The source of the plan change a lower level makes; the app says it in its own words. */
export const OWN_LEVEL_SOURCE = "ownLevel";

export const ownLevelChangeInputSchema = z
  .object({ level: ownLevelSchema, timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "OwnLevelChangeInput" });

export type OwnLevelChangeInput = z.infer<typeof ownLevelChangeInputSchema>;

/** A chapter the learner's new level says they may already know: a test-out would show it. */
export type OwnLevelTestOut = { chapterId: string; title: string };

/**
 * What changing your own level did. Lowering it adds the foundations the plan left out (`change`,
 * with an undo; null when the plan already starts from them). Raising it offers test-outs for the
 * chapters the new level covers; nothing is skipped until the learner passes one.
 */
export type OwnLevelChange = {
  change: PlanChangeView | null;
  direction: "higher" | "lower" | "same";
  level: z.infer<typeof ownLevelSchema>;
  testOuts: OwnLevelTestOut[];
};

export type OwnLevelChangeResult =
  | { ownLevel: OwnLevelChange; status: "ready" }
  | { status: "notFound" | "unauthorized" };
