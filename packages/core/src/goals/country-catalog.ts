import { getCountryChoices } from "@zoonk/utils/countries";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import { getLessonVariety } from "./_utils/content-country-view";
import { countryPickerChoiceSchema } from "./country-contract";

export const countryLanguageQuerySchema = z
  .object({ language: z.enum(SUPPORTED_LOCALES).default("en") })
  .strict();
export const countryCatalogSchema = z
  .object({ countries: z.array(countryPickerChoiceSchema) })
  .meta({ id: "CountryCatalog" });

export function getCountryCatalog(language: string) {
  return {
    countries: getCountryChoices({ userLanguage: language }).map((choice) => ({
      ...choice,
      lessonVariety: getLessonVariety({ code: choice.code, language }),
    })),
  };
}
