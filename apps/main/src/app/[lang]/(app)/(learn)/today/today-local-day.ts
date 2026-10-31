import "server-only";
import { getFormatter } from "next-intl/server";

/** Null when no goal says where the learner is, rather than a day that may be off by one. */
export async function getLocalDay({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone: string | null;
}): Promise<string | null> {
  "use cache: private";

  if (!timeZone) {
    return null;
  }

  const format = await getFormatter({ locale });

  return format.dateTime(new Date(), {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  });
}
