import { isCountryCode } from "@zoonk/utils/countries";
import { z } from "zod";

export const countryCodeSchema = z.string().refine(isCountryCode, { message: "Unknown country" });
export const countryChoiceSchema = z.object({ code: countryCodeSchema, name: z.string() });

export const goalContentCountrySchema = countryChoiceSchema
  .extend({
    editable: z.boolean(),
    kind: z.enum(["content", "exam"]),
    lessonVariety: z.object({ language: z.string(), region: countryCodeSchema }).nullable(),
    rebuild: z.enum(["none", "preparing", "failed"]),
    source: z.enum(["said", "home", "picked", "default"]),
  })
  .meta({ id: "GoalContentCountry" });

export type GoalContentCountry = z.infer<typeof goalContentCountrySchema>;
