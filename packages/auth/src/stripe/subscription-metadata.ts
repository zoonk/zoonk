import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { isValidTimeZone } from "@zoonk/utils/time-zone";

/**
 * The language and time zone of the emails about a subscription, which Stripe's webhooks and the
 * daily sweeps can't tell. The zone is null for subscriptions from before it was kept.
 */
type SubscriptionPreferences = { locale: string; timeZone: string | null };

function readTimeZone(timeZone: string | undefined): string | null {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
}

export function writeSubscriptionMetadata({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone?: string;
}): Record<string, string> {
  const zone = readTimeZone(timeZone);
  return zone ? { locale, timeZone: zone } : { locale };
}

export function readSubscriptionMetadata(
  metadata: Record<string, string>,
  fallbackLocale: string = DEFAULT_LOCALE,
): SubscriptionPreferences {
  return { locale: metadata.locale ?? fallbackLocale, timeZone: readTimeZone(metadata.timeZone) };
}
