import { z } from "zod";

export const unfundedMoveSchema = z
  .object({
    date: z.iso.date().describe("The day the learner asked to move the mock exam to."),
    minutes: z.number().positive().describe("The mock exam's real length on that day, in minutes."),
  })
  .meta({ id: "UnfundedMove" });

export type UnfundedMove = z.infer<typeof unfundedMoveSchema>;
