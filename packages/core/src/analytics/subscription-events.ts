import "server-only";
import { type SubscriptionChange } from "@zoonk/auth/subscription-events";
import { type AnalyticsEvent } from "./events";
import { trackLearnerEvents } from "./track-learner-event";

const SUBSCRIPTION_EVENT_NAMES = {
  canceled: "Subscription Canceled",
  started: "Subscription Conversion",
} as const;

export async function trackSubscriptionChange({
  change,
  plan,
  referenceId,
}: SubscriptionChange): Promise<void> {
  const event: AnalyticsEvent = { name: SUBSCRIPTION_EVENT_NAMES[change], properties: { plan } };
  await trackLearnerEvents({ events: [event], userId: referenceId });
}
