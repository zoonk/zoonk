import { getPostHogConfig } from "@zoonk/utils/posthog";
import { type PostHog } from "posthog-js";

/** Starts PostHog even on a page that stays busy, so analytics never waits for long. */
const IDLE_TIMEOUT_MS = 2000;

let postHog: Promise<PostHog | null> | null = null;

function afterPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = () => {
      if ("requestIdleCallback" in globalThis) {
        requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
        return;
      }

      setTimeout(resolve, 0);
    };

    if (document.readyState === "complete") {
      whenIdle();
      return;
    }

    globalThis.addEventListener("load", whenIdle, { once: true });
  });
}

/**
 * PostHog's browser SDK, loaded and started once after the page has loaded, so its size never
 * delays the first paint. Apps call it from `instrumentation-client` so every page starts it, and
 * every browser analytics call waits for it, which keeps events sent during hydration. Resolves to
 * null when PostHog isn't configured or outside the browser. Session replay is off at start:
 * `PostHogIdentify` turns it on only for learners whose age allows it.
 */
export function loadPostHog(): Promise<PostHog | null> {
  const config = getPostHogConfig();

  if (!config || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  postHog ??= afterPageLoad()
    .then(() => import("posthog-js"))
    .then(({ default: client }) => {
      client.init(config.projectToken, {
        api_host: config.host,
        defaults: config.defaults,
        disable_session_recording: true,
      });

      return client;
    });

  return postHog;
}
