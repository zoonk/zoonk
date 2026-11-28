import { z } from "zod";

export const finishPrecisionSchema = z.enum(["month", "year"]).meta({ id: "PlanFinishPrecision" });

export const finishReasonSchema = z
  .enum(["nothingLeft", "noStudyDays", "beyondHorizon"])
  .meta({ id: "PlanFinishReason" });

export const finishDisplayFields = {
  finishReason: finishReasonSchema
    .nullish()
    .meta({
      description: "Why an undated forecast has no finish date, when a forecast is available",
    }),
  precision: finishPrecisionSchema
    .nullish()
    .meta({ description: "The precision of the estimated finish date when it is available" }),
};

export type FinishPrecision = z.infer<typeof finishPrecisionSchema>;
export type FinishReason = z.infer<typeof finishReasonSchema>;
