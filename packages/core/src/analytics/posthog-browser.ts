import { getPostHogConfig } from "@zoonk/utils/posthog";
import { type PostHog } from "posthog-js";
import { type SharedEventProperties } from "./shared-properties";

const IDLE_TIMEOUT_MS = 2000;

let postHog: Promise<PostHog | null> | null = null;
let sharing = false;
const decided = Promise.withResolvers<null>();

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

/** Loaded once, after the page has, so its size never delays the first paint; a "no" before then cancels it. */
function loadClient(config: NonNullable<ReturnType<typeof getPostHogConfig>>) {
  postHog ??= afterPageLoad()
    .then(() => (sharing ? import("posthog-js") : null))
    .then((module) => {
      if (!module || !sharing) {
        postHog = null;
        return null;
      }

      module.default.init(config.projectToken, {
        api_host: config.host,
        defaults: config.defaults,
        disable_session_recording: true,
      });

      return module.default;
    });

  return postHog;
}

/**
 * Nothing loads or is stored on the device before this, so a page where the visitor hasn't said yes
 * never starts PostHog. Only an adult is recorded or keeps the identity this browser holds; anyone
 * else's events stay anonymous, an earlier learner's identity on this browser included.
 */
export async function startPostHog({ adult }: { adult: boolean }): Promise<void> {
  const config = getPostHogConfig();

  if (!config || typeof document === "undefined") {
    return;
  }

  sharing = true;
  decided.resolve(null);

  const client = await loadClient(config);

  if (!client || !sharing) {
    return;
  }

  if (!adult && client.get_property("$user_state") === "identified") {
    client.reset();
  }

  if (client.has_opted_out_capturing()) {
    client.opt_in_capturing({ captureEventName: false });
  }

  if (adult) {
    client.startSessionRecording();
  } else {
    client.stopSessionRecording();
  }
}

export async function stopPostHog(): Promise<void> {
  sharing = false;
  decided.resolve(null);

  const client = await postHog;
  client?.stopSessionRecording();
  client?.opt_out_capturing();
}

/** Waits for the page to decide, so events sent while it hasn't are dropped unless it says yes. */
export async function loadPostHog(): Promise<PostHog | null> {
  await decided.promise;
  return sharing ? postHog : null;
}

/** Doesn't wait for a decision: logging out must never hang on one that won't come. */
export function getStartedPostHog(): Promise<PostHog | null> {
  return (sharing && postHog) || Promise.resolve(null);
}

const SHARED_PROPERTIES_WAIT_MS = 5000;

let sharedPropertiesRegistered: Promise<void> = Promise.resolve();
let markSharedPropertiesRegistered: (() => void) | null = null;

export function waitForSharedProperties() {
  if (typeof document === "undefined") {
    return;
  }

  sharedPropertiesRegistered = new Promise((resolve) => {
    markSharedPropertiesRegistered = resolve;
    setTimeout(resolve, SHARED_PROPERTIES_WAIT_MS);
  });
}

export async function registerSharedProperties(properties: SharedEventProperties): Promise<void> {
  const posthog = await loadPostHog();
  posthog?.register(properties);
  markSharedPropertiesRegistered?.();
}

export async function loadPostHogForEvents(): Promise<PostHog | null> {
  await sharedPropertiesRegistered;
  return loadPostHog();
}
