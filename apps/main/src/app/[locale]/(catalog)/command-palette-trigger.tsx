"use client";

import { CommandPaletteTrigger as TriggerBase } from "@zoonk/next/patterns/command-palette/command-palette-trigger";
import { useExtracted } from "next-intl";

/**
 * Localized command palette trigger for the main app.
 */
export function CommandPaletteTrigger() {
  const t = useExtracted();
  return <TriggerBase label={t("Search")} />;
}
