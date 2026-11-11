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

export const MAX_SUGGESTED_COUNTRIES = 8;

export const suggestedCountrySchema = countryChoiceSchema.extend({
  tag: z.literal("home").nullable(),
});
export const suggestedCountriesSchema = z
  .array(suggestedCountrySchema)
  .max(MAX_SUGGESTED_COUNTRIES);
export type SuggestedCountry = z.infer<typeof suggestedCountrySchema>;

export const goalCountryFieldsSchema = z.object({
  contentCountry: goalContentCountrySchema
    .nullable()
    .meta({
      description:
        "The content or exam country row; null for general goals, older unclassified goals, an unanswered country question, and own-country or international exams.",
    }),
  countryDependent: z
    .boolean()
    .meta({
      description:
        "True for a learn goal read as country-dependent, including an older goal after an explicit country change. False for general, unclassified, exam, and language goals.",
    }),
  examCountry: countryChoiceSchema.nullable(),
  examplesCountry: countryChoiceSchema.nullable(),
  languageCountry: countryChoiceSchema.nullable(),
  suggested: suggestedCountriesSchema,
});
export type GoalCountryFields = z.infer<typeof goalCountryFieldsSchema>;
