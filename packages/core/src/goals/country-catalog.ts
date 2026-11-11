import { getCountryChoices } from "@zoonk/utils/countries";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import { countryChoiceSchema } from "./country-contract";

export const countryLanguageQuerySchema = z
  .object({ language: z.enum(SUPPORTED_LOCALES).default("en") })
  .strict();
export const countryCatalogSchema = z
  .object({ countries: z.array(countryChoiceSchema) })
  .meta({ id: "CountryCatalog" });

export function getCountryCatalog(language: string) {
  return { countries: getCountryChoices({ userLanguage: language }) };
}
