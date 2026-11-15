import { getExtracted } from "next-intl/server";

/** A null limit means the free plan has no cap of that length, so the sentence leaves it out. */
export async function getStudyBuddyAllowance({
  perDay,
  per30Days,
}: {
  perDay: number | null;
  per30Days: number | null;
}): Promise<string> {
  const t = await getExtracted();

  if (perDay !== null && per30Days !== null) {
    return t(
      "An AI study buddy: {count, plural, one {# message} other {# messages}} a day, up to {month} a month",
      { count: perDay, month: String(per30Days) },
    );
  }

  if (perDay !== null) {
    return t("An AI study buddy: {count, plural, one {# message} other {# messages}} a day", {
      count: perDay,
    });
  }

  if (per30Days !== null) {
    return t(
      "An AI study buddy: up to {month, plural, one {# message} other {# messages}} a month",
      { month: per30Days },
    );
  }

  return t("An AI study buddy");
}
