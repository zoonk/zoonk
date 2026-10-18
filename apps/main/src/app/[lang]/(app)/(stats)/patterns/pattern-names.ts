import { getExtracted } from "next-intl/server";

/**
 * The four parts of the day by name, in core's period order (night, morning, afternoon, evening),
 * so the overview and the Patterns page say them the same way.
 */
export async function getTimePeriodNames(): Promise<readonly string[]> {
  const t = await getExtracted();
  return [t("Night"), t("Morning"), t("Afternoon"), t("Evening")];
}
