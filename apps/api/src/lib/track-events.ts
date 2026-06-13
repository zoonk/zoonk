import { getPostHogConfig } from "@zoonk/utils/posthog";
import posthog from "posthog-js";

type AuthMethod = "apple" | "google" | "otp";
type AnalyticsEventProperties = Record<string, boolean | number | string>;

/**
 * Records the provider the user chose on the login page before the browser may
 * leave for an OAuth provider or the OTP page.
 */
export function trackSignInMethodChosen({ method }: { method: AuthMethod }) {
  trackEvent({ name: "Sign In Method Chosen", properties: { method } });
}

/**
 * Sends API auth events to PostHog only when the browser SDK has a configured
 * project, matching the app's instrumentation-client initialization gate.
 */
function trackEvent({ name, properties }: { name: string; properties: AnalyticsEventProperties }) {
  if (!getPostHogConfig()) {
    return;
  }

  posthog.capture(name, properties);
}
