"use client";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@zoonk/ui/components/dropdown-menu";
import { useShortcutCap } from "@zoonk/ui/components/kbd";
import { openCommandPalette } from "@zoonk/ui/lib/command-palette-event";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function SearchDropdownItem() {
  const t = useExtracted();
  const shortcut = useShortcutCap("search");

  return (
    <>
      <DropdownMenuItem aria-keyshortcuts={shortcutKeys("search")} onClick={openCommandPalette}>
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
