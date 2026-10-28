import { getPostHogConfig } from "@zoonk/utils/posthog";
import { type PostHog } from "posthog-js";
import { type SharedEventProperties } from "./shared-properties";

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

export function loadPostHog(): Promise<PostHog | null> {
  const config = getPostHogConfig();

  if (!config || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  postHog ??= afterPageLoad()
    .then(() => import("posthog-js"))
    .then(({ default: client }) => {
      client.init(config.projectToken, { api_host: config.host, defaults: config.defaults });

      return client;
    });

  return postHog;
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
