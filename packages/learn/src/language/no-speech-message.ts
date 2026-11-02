"use client";

import { useExtracted } from "next-intl";

export function useNoSpeechMessage(): string {
  const t = useExtracted();
  return t("We couldn't hear any words. Try again.");
}
