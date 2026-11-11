"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { countryPickerChoiceSchema } from "@zoonk/core/goals/country-contract";
import { safeAsync } from "@zoonk/utils/error";
import { z } from "zod";

const catalogSchema = z.object({ countries: z.array(countryPickerChoiceSchema) });

/** The API's public, cached list: the browser and the CDN keep it for a day, so pickers share it. */
export async function loadCountries(language: string) {
  const url = `${getBrowserApiUrl()}/v1/countries?language=${encodeURIComponent(language)}`;
  const { data: response } = await safeAsync(() => fetch(url));

  if (!response?.ok) {
    return null;
  }

  const { data } = await safeAsync<unknown>(() => response.json());
  return catalogSchema.safeParse(data).data?.countries ?? null;
}
