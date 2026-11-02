import "server-only";
import { registerSubscriptionChangeSink } from "@zoonk/auth/subscription-events";
import { type AnalyticsEvent } from "./events";
import { trackLearnerEvents } from "./track-learner-event";

const SUBSCRIPTION_EVENT_NAMES = {
  canceled: "Subscription Canceled",
  started: "Subscription Conversion",
} as const;

export function registerSubscriptionAnalytics(): void {
  registerSubscriptionChangeSink(({ change, plan, referenceId }) => {
    const event: AnalyticsEvent = { name: SUBSCRIPTION_EVENT_NAMES[change], properties: { plan } };
    return trackLearnerEvents({ events: [event], userId: referenceId });
  });
}
