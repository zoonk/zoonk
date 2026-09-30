import { z } from "zod";

const MAX_INSTRUMENT_LENGTH = 60;
const MIN_LANGUAGE_LENGTH = 2;
const MAX_LANGUAGE_LENGTH = 10;

export const instrumentWaitlistJoinSchema = z
  .object({
    instrument: z
      .string()
      .trim()
      .min(1)
      .max(MAX_INSTRUMENT_LENGTH)
      .meta({
        description:
          "The instrument in the learner's words, like the `instrument` a goal understanding returned",
        example: "violão",
      }),
    language: z
      .string()
      .min(MIN_LANGUAGE_LENGTH)
      .max(MAX_LANGUAGE_LENGTH)
      .meta({ description: "The language the learner wrote in", example: "pt" }),
  })
  .strict();

export type InstrumentWaitlistJoinInput = z.infer<typeof instrumentWaitlistJoinSchema>;

/** One instrument the learner is waiting to learn to play. */
export type InstrumentWaitlistEntryView = {
  id: string;
  instrument: string;
  joinedAt: string;
  language: string;
};
