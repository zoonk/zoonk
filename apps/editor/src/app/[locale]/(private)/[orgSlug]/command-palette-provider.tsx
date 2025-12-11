"use client";

import { CommandPaletteProvider as Provider } from "@zoonk/next/patterns/command-palette/command-palette-provider";
import { CommandPaletteTrigger as TriggerBase } from "@zoonk/next/patterns/command-palette/command-palette-trigger";
import { useExtracted } from "next-intl";

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider>{children}</Provider>;
}

/**
 * Localized command palette trigger for the editor app.
 */
export function CommandPaletteTrigger() {
  const t = useExtracted();
  return <TriggerBase label={t("Search")} />;
}
