import { isPrivateLearningPage } from "./analytics-privacy";

/**
 * Google's documented image tag reports the existing conversion without loading a
 * persistent script that can observe private learning routes or form contents.
 * This deliberately forgoes the global tag's first-party conversion linker.
 * https://support.google.com/google-ads/answer/7280698
 */
export function sendGoogleAdsConversion() {
  const destination = process.env.NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_CONVERSION_ID;
  const match = destination?.match(/^AW-(?<account>\d+)\/(?<label>[\w-]+)$/u);

  if (
    !match?.groups?.account ||
    !match.groups.label ||
    typeof Image === "undefined" ||
    isPrivateLearningPage()
  ) {
    return;
  }

  const url = new URL(
    `https://www.googleadservices.com/pagead/conversion/${match.groups.account}/`,
  );

  url.searchParams.set("label", match.groups.label);
  url.searchParams.set("guid", "ON");
  url.searchParams.set("script", "0");
  /** A later subscription is a distinct conversion even when the browser cached the image. */
  url.searchParams.set("random", String(Math.random()));

  const pixel = new Image(1, 1);
  pixel.referrerPolicy = "no-referrer";
  pixel.src = url.href;
}
