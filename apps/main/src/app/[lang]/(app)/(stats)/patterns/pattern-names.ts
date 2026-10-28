import { getExtracted } from "next-intl/server";

/** In core's period order: night, morning, afternoon, evening. */
export async function getTimePeriodNames(): Promise<readonly string[]> {
  const t = await getExtracted();
  return [t("Night"), t("Morning"), t("Afternoon"), t("Evening")];
}
