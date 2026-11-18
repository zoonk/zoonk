"use client";

import { useExtracted } from "next-intl";
import { GateWords, SubscribeGate } from "../../_components/subscribe-gate";

export function useChallengeCallGateTitle(): string {
  const t = useExtracted();
  return t("This call needs a subscription");
}

/**
 * `words` is for a screen whose bar holds "Subscribe"; in place, the gate brings its own.
 * `untitled` is in place on a screen whose title already says the call needs a subscription.
 */
export function ChallengeCallGate({ form }: { form: "inPlace" | "untitled" | "words" }) {
  const t = useExtracted();
  const title = useChallengeCallGateTitle();
  const line = t("Your plan goes on without it.");

  return form === "words" ? (
    <GateWords line={line} title={title} />
  ) : (
    <SubscribeGate title={form === "untitled" ? undefined : title}>{line}</SubscribeGate>
  );
}
