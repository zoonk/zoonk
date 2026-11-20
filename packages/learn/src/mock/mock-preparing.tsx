"use client";

import { useExtracted } from "next-intl";
import { GateWords } from "../_components/subscribe-gate";

/**
 * Said over the bar, beside "Keep studying", while a mock's questions are still being written: it
 * never starts by itself.
 */
export function MockPreparingWords() {
  const t = useExtracted();

  return (
    <GateWords
      line={t("Come back to this page to start it.")}
      title={t("Your mock exam is being prepared")}
    />
  );
}
