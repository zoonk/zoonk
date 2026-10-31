import { z } from "zod";
import { logicalDateSchema } from "./study-sessions";

export const noticeDaySchema = z
  .object({
    date: logicalDateSchema,
    estimated: z
      .boolean()
      .meta({ description: "The likely day, while the edition's notice isn't out" }),
  })
  .nullable()
  .meta({
    description:
      "The exam day the notice gives when the plan counts down to another, to offer with one tap (a setTargetDate change); null otherwise",
  });

export const noSittingSchema = z
  .object({
    closest: z
      .array(logicalDateSchema)
      .meta({
        description:
          "The first day of the closest sittings still open for registration, before and after `month`, each to offer with one tap (a setTargetDate change)",
      }),
    month: logicalDateSchema.meta({ description: "The first day of the learner's month" }),
  })
  .nullable()
  .meta({
    description:
      "An exam held several times a year with no sitting in the month of the learner's date; their date stays until they pick one. Null otherwise",
  });
