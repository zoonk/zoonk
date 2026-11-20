"use client";

import { Kbd, useShortcutCap } from "@zoonk/ui/components/kbd";
import { type ShortcutName } from "@zoonk/ui/lib/shortcuts";

export function KeyCap({ shortcut }: { shortcut: ShortcutName }) {
  return <Kbd>{useShortcutCap(shortcut)}</Kbd>;
}
