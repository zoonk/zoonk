import "server-only";
import { createServerPostHogClient } from "@/lib/server-posthog";
import { safeAsync } from "@zoonk/utils/error";

type AuthCompletionAction = "sign-in" | "sign-up";
type ServerEventProperties = Record<string, boolean | number | string>;

/**
 * Captures one API server event with a short-lived PostHog client so event
 * helpers only need to choose names and properties instead of repeating SDK
 * lifecycle code.
 */
async function trackServerEvent({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: string;
  properties?: ServerEventProperties;
}) {
  await safeAsync(async () => {
    const posthog = createServerPostHogClient();

    if (!posthog) {
      return;
    }

    await using client = posthog;

    client.capture({ distinctId, event, properties });
  });
}

/**
 * Captures completed auth outcomes from the server callback because that route
 * already knows whether the returning session still needs first-time setup.
 */
export async function trackAuthCompleted({
  action,
  userId,
}: {
  action: AuthCompletionAction;
  userId: string;
}) {
  await trackServerEvent({
    distinctId: userId,
    event: action === "sign-up" ? "Sign Up Completed" : "Sign In Completed",
  });
}
