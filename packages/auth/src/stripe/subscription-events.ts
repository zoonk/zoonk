import { safeAsync } from "@zoonk/utils/error";

type SubscriptionChange = { change: "canceled" | "started"; plan: string; referenceId: string };
type SubscriptionChangeSink = (event: SubscriptionChange) => Promise<void>;

declare global {
  /** Next.js bundles instrumentation and routes separately, so a module variable set in `register()` isn't the one routes read. */
  var zoonkSubscriptionChangeSink: SubscriptionChangeSink | undefined;
}

/** Core's analytics depend on this package, so it can't call them itself. */
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
