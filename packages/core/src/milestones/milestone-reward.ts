import { z } from "zod";

/** Kept with a paid reward so an interrupted milestone write can replay its original crossing. */
export const brainPowerRewardSchema = z.object({ after: z.number(), before: z.number() });

export type BrainPowerReward = z.infer<typeof brainPowerRewardSchema>;
