"use client";

import { Button } from "@zoonk/ui/components/button";
import { Search } from "lucide-react";
import { useCommandPalette } from "./command-palette-provider";

type CommandPaletteTriggerProps = {
  /**
   * Accessible label for the button.
   * @default "Search"
   */
  label?: string;
};

/**
 * Button that opens the command palette when clicked.
 * Shows a search icon and announces keyboard shortcuts to assistive technology.
 */
export function CommandPaletteTrigger({
  label = "Search",
}: CommandPaletteTriggerProps) {
  const { open } = useCommandPalette();

  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      onClick={open}
      size="icon"
      variant="outline"
    >
      <Search />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
