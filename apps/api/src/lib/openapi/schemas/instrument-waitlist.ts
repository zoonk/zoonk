import { type InstrumentWaitlistEntryView } from "@zoonk/core/instrument-waitlist/contract";
import { z } from "zod";

const instrumentWaitlistEntrySchema = z
  .object({
    id: z.uuid(),
    instrument: z.string().meta({ description: "The instrument in the learner's words" }),
    joinedAt: z.iso.datetime(),
    language: z.string().meta({ description: "The language the learner wrote in" }),
  })
  .meta({ id: "InstrumentWaitlistEntry" }) satisfies z.ZodType<InstrumentWaitlistEntryView>;

export const instrumentWaitlistResponseSchema = z
  .object({ entries: z.array(instrumentWaitlistEntrySchema) })
  .meta({ id: "InstrumentWaitlist" });

export const instrumentWaitlistEntryResponseSchema = z
  .object({ entry: instrumentWaitlistEntrySchema })
  .meta({ id: "InstrumentWaitlistEntryResponse" });
