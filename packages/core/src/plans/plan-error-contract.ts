import { z } from "zod";

/**
 * Why a learner's move of a mock exam was refused (`unfundedMove`): at its new day the mock is this
 * long (its real length there, a whole exam day in the final stretch), and the study days before
 * that day can't set aside the time it needs. The plan stays as it was; a later day may fit.
 */
export const unfundedMoveSchema = z
  .object({
    date: z.iso.date().describe("The day the learner asked to move the mock exam to."),
    minutes: z.number().positive().describe("The mock exam's real length on that day, in minutes."),
  })
  .meta({ id: "UnfundedMove" });

export type UnfundedMove = z.infer<typeof unfundedMoveSchema>;
