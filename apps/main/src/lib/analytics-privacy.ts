import { type BeforeSendEvent } from "@vercel/analytics";
import { type CaptureResult } from "posthog-js";

/** Private learning data also appears in return URLs and localized legacy prompt routes. */
const PRIVATE_LEARNING_PATH =
  /\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:b\/me(?:\/|$|[?#"'&\s])|start\/(?:discovery|learn)(?:\/|$|[?#"'&\s])|tracks(?:\/|$|[?#"'&\s])|my(?:\/|$|[?#"'&\s])|profile\/interests(?:\/|$|[?#"'&\s])|generate(?:\/|$|[?#"'&\s])|b\/[^/?#]+\/c\/[^/?#]+\/(?:start|preferences)(?:\/|$|[?#"'&\s]))/iu;

export function hasPrivateLearningUrl(value: string): boolean {
  if (PRIVATE_LEARNING_PATH.test(value)) {
    return true;
  }

  try {
    const decoded = decodeURIComponent(value);

    return (
      PRIVATE_LEARNING_PATH.test(decoded) ||
      (decoded !== value && PRIVATE_LEARNING_PATH.test(decodeURIComponent(decoded)))
    );
  } catch {
    return false;
  }
}

/** Error breadcrumbs and transition spans can retain a private URL after returning to a public page. */
export function filterPrivateTelemetryEvent<T>(event: T): T | null {
  return isPrivateLearningPage() || hasPrivateLearningUrl(JSON.stringify(event)) ? null : event;
}

export function isPrivateLearningPage() {
  return globalThis.location !== undefined && hasPrivateLearningUrl(globalThis.location.href);
}

/** Remove persisted attribution URLs as well, so later public events cannot disclose a private visit. */
function redactPrivateUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return hasPrivateLearningUrl(value) ? "[private]" : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPrivateUrls(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactPrivateUrls(item)]),
    );
  }

  return value;
}

export function filterPostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (
    !event ||
    isPrivateLearningPage() ||
    (typeof event.properties.$current_url === "string" &&
      hasPrivateLearningUrl(event.properties.$current_url))
  ) {
    return null;
  }

  return {
    ...event,
    properties: Object.fromEntries(
      Object.entries(event.properties).map(([key, value]) => [key, redactPrivateUrls(value)]),
    ),
  };
}

export function filterVercelEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (
    isPrivateLearningPage() ||
    hasPrivateLearningUrl(event.url) ||
    (typeof document !== "undefined" && hasPrivateLearningUrl(document.referrer))
  ) {
    return null;
  }

  return event;
}
