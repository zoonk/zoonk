"use client";

import { CommandInput } from "@zoonk/ui/components/command";
import { useQueryState } from "nuqs";

type CommandPaletteSearchProps = {
  /**
   * Placeholder text for the search input.
   * @default "Search..."
   */
  placeholder?: string;
  /**
   * URL query parameter name for the search value.
   * @default "q"
   */
  queryParam?: string;
  /**
   * Throttle time in milliseconds for URL updates.
   * @default 300
   */
  throttleMs?: number;
};

/**
 * Search input that syncs its value with the URL query string.
 * Uses nuqs for URL state management with built-in throttling.
 */
export function CommandPaletteSearch({
  placeholder = "Search...",
  queryParam = "q",
  throttleMs = 300,
}: CommandPaletteSearchProps) {
  const [query, setQuery] = useQueryState(queryParam, {
    defaultValue: "",
    shallow: false,
    throttleMs,
  });

  return (
    <CommandInput
      onValueChange={setQuery}
      placeholder={placeholder}
      value={query}
    />
  );
}
