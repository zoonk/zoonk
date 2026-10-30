"use client";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@zoonk/ui/components/dropdown-menu";
import { useShortcutLabel } from "@zoonk/ui/hooks/shortcut-label";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { openCommandPalette } from "./command-palette-event";

export function SearchDropdownItem() {
  const t = useExtracted();
  const shortcut = useShortcutLabel("K");

  return (
    <>
      <DropdownMenuItem aria-keyshortcuts="Meta+K Control+K" onClick={openCommandPalette}>
        <SearchIcon aria-hidden="true" />
        {t("Search or ask…")}
        <DropdownMenuShortcut aria-hidden="true" className="hidden lg:pointer-fine:inline">
          {shortcut}
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
