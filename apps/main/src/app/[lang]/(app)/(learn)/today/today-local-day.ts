import "server-only";
import { getFormatter } from "next-intl/server";

/**
 * The learner's day as Today's date line says it ("Mon, Oct 12"), in their goal's time zone, for
 * the states that have no session to date (no goal, a paused one); null when no goal says where
 * they are, rather than a day that may be off by one.
 */
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
