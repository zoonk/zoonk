"use client";

import { useExtracted } from "next-intl";
import { GateWords, SubscribeGate } from "../../_components/subscribe-gate";

/** `words` is for a screen whose bar holds "Subscribe"; in place, the gate brings its own. */
export function ChallengeCallGate({ form }: { form: "inPlace" | "words" }) {
  const t = useExtracted();
  const title = t("This call needs a subscription");
  const line = t("Your plan goes on without it.");

  return form === "words" ? (
    <GateWords line={line} title={title} />
  ) : (
    <SubscribeGate title={title}>{line}</SubscribeGate>
  );
}
