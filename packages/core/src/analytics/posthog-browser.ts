import { getPostHogConfig } from "@zoonk/utils/posthog";
import { type PostHog } from "posthog-js";
import { type SharedEventProperties } from "./shared-properties";

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

/** How long events wait for the layout's shared properties before they go without them. */
const SHARED_PROPERTIES_WAIT_MS = 5000;

let sharedPropertiesRegistered: Promise<void> = Promise.resolve();
let markSharedPropertiesRegistered: (() => void) | null = null;

/**
 * For apps whose layout registers the shared properties (`RegisterSharedEventProperties`), called
 * before the page renders. That layout streams in, so a screen can report its view before the
 * properties are registered: its event waits for them instead of going without them. A page that
 * never registers them (its analytics lookup failed) sends its events after a few seconds anyway.
 */
export function waitForSharedProperties() {
  if (typeof document === "undefined") {
    return;
  }

  sharedPropertiesRegistered = new Promise((resolve) => {
    markSharedPropertiesRegistered = resolve;
    setTimeout(resolve, SHARED_PROPERTIES_WAIT_MS);
  });
}

/** Registers the shared properties as PostHog super properties, so every later event carries them. */
export async function registerSharedProperties(properties: SharedEventProperties): Promise<void> {
  const posthog = await loadPostHog();
  posthog?.register(properties);
  markSharedPropertiesRegistered?.();
}

/** PostHog for sending an event: once it has loaded and the shared properties are registered. */
export async function loadPostHogForEvents(): Promise<PostHog | null> {
  await sharedPropertiesRegistered;
  return loadPostHog();
}
