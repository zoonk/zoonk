import "server-only";
import { registerSubscriptionChangeSink } from "@zoonk/auth/subscription-events";
import { type AnalyticsEvent } from "./events";
import { trackLearnerEvents } from "./track-learner-event";

const SUBSCRIPTION_EVENT_NAMES = {
  canceled: "Subscription Canceled",
  started: "Subscription Conversion",
} as const;

/**
 * Sends "Subscription Conversion" (the plan's "Subscription Started") and "Subscription Canceled"
 * from the Stripe webhooks Better Auth handles, so a learner who never returns from checkout still
 * counts. Each app that serves Better Auth calls this from `instrumentation.ts`, since
 * `@zoonk/auth` can't depend on core.
 */
export function registerSubscriptionAnalytics(): void {
  registerSubscriptionChangeSink(({ change, plan, referenceId }) => {
    const event: AnalyticsEvent = { name: SUBSCRIPTION_EVENT_NAMES[change], properties: { plan } };
    return trackLearnerEvents({ events: [event], userId: referenceId });
  });
}
