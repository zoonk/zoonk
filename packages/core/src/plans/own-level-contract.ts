import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { ownLevelSchema } from "../learner/placement/placement-contract";
import { type PlanChangeView } from "./plan-view-contract";

export const OWN_LEVEL_SOURCE = "ownLevel";

export const ownLevelChangeInputSchema = z
  .object({ level: ownLevelSchema, timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "OwnLevelChangeInput" });

export type OwnLevelChangeInput = z.infer<typeof ownLevelChangeInputSchema>;

export type OwnLevelTestOut = { chapterId: string; title: string };

export type OwnLevelChange = {
  change: PlanChangeView | null;
  direction: "higher" | "lower" | "same";
  level: z.infer<typeof ownLevelSchema>;
  testOuts: OwnLevelTestOut[];
};

export type OwnLevelChangeResult =
  | { ownLevel: OwnLevelChange; status: "ready" }
  | { status: "notFound" | "unauthorized" };
