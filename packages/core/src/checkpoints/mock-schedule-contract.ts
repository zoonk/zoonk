import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { studySessionTimeZoneInputSchema } from "../sessions/contract";

export const mockScheduleInputSchema = studySessionTimeZoneInputSchema
  .extend({
    date: z.iso
      .date()
      .nullable()
      .meta({ description: "A new study day, or null to skip this mock." }),
  })
  .meta({ id: "MockScheduleInput" });
export const mockScheduleOptionsSchema = z
  .object({ dates: z.array(z.iso.date()) })
  .meta({ id: "MockScheduleOptions" });
export const mockScheduleChangeSchema = z
  .object({ changeId: uuidSchema(), planItemId: uuidSchema() })
  .meta({ id: "MockScheduleChange" });
