"use client";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@zoonk/ui/components/dropdown-menu";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { openCommandPalette } from "./command-palette-event";

/** Apple keyboards say ⌘ where the others say Ctrl; the server can't tell, so it says ⌘. */
function useShortcutLabel() {
  const isMounted = useIsMounted();
  const isApple = !isMounted || /Mac|iPhone|iPad|iPod/u.test(navigator.userAgent);

  return isApple ? "⌘K" : "Ctrl K";
}

/**
 * "Search" opens the app's command palette, the same one Cmd/Ctrl+K opens anywhere, and shows the
 * shortcut where there's a keyboard.
 */
export function SearchDropdownItem() {
  const t = useExtracted();
  const shortcut = useShortcutLabel();

  return (
    <>
      <DropdownMenuItem aria-keyshortcuts="Meta+K Control+K" onClick={openCommandPalette}>
        <SearchIcon aria-hidden="true" />
        {t("Search")}
        <DropdownMenuShortcut aria-hidden="true" className="hidden lg:pointer-fine:inline">
          {shortcut}
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
