"use client";

import { listenForKeyboardShortcuts } from "@/lib/keyboard-shortcuts-event";
import { useShortcut } from "@zoonk/ui/hooks/keyboard";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { useEffect, useState } from "react";
import { canOpenPalette, usePaletteAllowed } from "./app-command-palette";

const shortcutsDialog = createOnDemand(() => import("./app-keyboard-shortcuts-dialog"));

/** The list of keys, wherever the palette is: `?` opens it, and so does the palette by name. */
export function AppKeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const allowed = usePaletteAllowed();
  const Dialog = shortcutsDialog.useModule({ enabled: open && allowed })?.default;

  useShortcut("shortcuts", () => (canOpenPalette() ? setOpen(true) : false));
  useEffect(() => listenForKeyboardShortcuts(() => setOpen(true)), []);

  return Dialog ? <Dialog onOpenChange={setOpen} open={open} /> : null;
}
