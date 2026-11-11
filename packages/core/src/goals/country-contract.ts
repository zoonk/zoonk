import { isCountryCode } from "@zoonk/utils/countries";
import { z } from "zod";

export const countryCodeSchema = z.string().refine(isCountryCode, { message: "Unknown country" });
export const countryChoiceSchema = z.object({ code: countryCodeSchema, name: z.string() });
