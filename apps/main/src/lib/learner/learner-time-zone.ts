import { isValidTimeZone } from "@zoonk/utils/time-zone";

/** Written by the browser on every page, so the next request's server render draws in its zone. */
export const TIME_ZONE_COOKIE = "tz";

export const IP_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

/** The browser's own zone, else the one Vercel guesses from the address (a VPN's), else UTC. */
export function pickLearnerTimeZone({
  cookie,
  header,
}: {
  cookie: string | null | undefined;
  header: string | null | undefined;
}): string {
  return [cookie, header].find((zone) => zone && isValidTimeZone(zone)) ?? "UTC";
}
