import { safeAsync } from "@zoonk/utils/error";

/** A subscription Stripe confirmed through checkout, or one whose cancellation became pending. */
type SubscriptionChange = { change: "canceled" | "started"; plan: string; referenceId: string };
type SubscriptionChangeSink = (event: SubscriptionChange) => Promise<void>;

declare global {
  /**
   * Lives on `globalThis` like the AI generation sink: Next.js bundles instrumentation and routes
   * separately, so a module variable set in `register()` isn't the one webhooks would read.
   */
  var zoonkSubscriptionChangeSink: SubscriptionChangeSink | undefined;
}

/**
 * Lets the app serving Stripe webhooks send subscription changes to analytics. Core's analytics
 * depend on this package, so it can't call them itself.
 */
export function registerSubscriptionChangeSink(sink: SubscriptionChangeSink): void {
  globalThis.zoonkSubscriptionChangeSink = sink;
}

/** Analytics never fails a webhook. */
export async function reportSubscriptionChange(event: SubscriptionChange): Promise<void> {
  const sink = globalThis.zoonkSubscriptionChangeSink;

  if (!sink) {
    return;
  }

  await safeAsync(() => sink(event));
}
