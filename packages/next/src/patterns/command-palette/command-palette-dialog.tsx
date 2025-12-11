"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import type { LucideIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCommandPalette } from "./command-palette-provider";
import { CommandPaletteSearch } from "./command-palette-search";

/**
 * A static page item that can be displayed in the command palette.
 */
export type CommandPaletteStaticPage = {
  /**
   * Icon component to display next to the item.
   */
  icon: LucideIcon;
  /**
   * Display label for the item. Also used for filtering.
   */
  label: string;
  /**
   * URL to navigate to when this item is selected.
   */
  url: string;
};

/**
 * Labels for the command palette dialog.
 * Pass these to localize the UI.
 */
export type CommandPaletteLabels = {
  /**
   * Accessible label for the close button.
   * @default "Close"
   */
  close?: string;
  /**
   * Description of the command palette for accessibility.
   * @default "Search..."
   */
  description?: string;
  /**
   * Text to show when there are no results.
   * @default "No results found"
   */
  emptyText?: string;
  /**
   * Heading for the static pages group.
   * @default "Pages"
   */
  pagesHeading?: string;
  /**
   * Placeholder text for the search input.
   * @default "Search..."
   */
  placeholder?: string;
  /**
   * Title of the command palette for accessibility.
   * @default "Search"
   */
  title?: string;
};

type CommandPaletteDialogProps = {
  /**
   * Children to render (typically server components with search results).
   */
  children?: React.ReactNode;
  /**
   * Labels for localization.
   */
  labels?: CommandPaletteLabels;
  /**
   * Callback when an item is selected.
   * Use this to handle navigation in your app.
   */
  onSelect: (url: string) => void;
  /**
   * URL query parameter name for the search value.
   * @default "q"
   */
  queryParam?: string;
  /**
   * Static pages to display in the command palette.
   * These are filtered based on the search query.
   */
  staticPages?: CommandPaletteStaticPage[];
};

/**
 * The main command palette dialog.
 * Handles opening/closing, search input, filtering static pages,
 * and rendering children (typically server-fetched results).
 */
export function CommandPaletteDialog({
  children,
  labels = {},
  onSelect,
  queryParam = "q",
  staticPages = [],
}: CommandPaletteDialogProps) {
  const { isOpen, close } = useCommandPalette();
  const [query, setQuery] = useQueryState(queryParam, { shallow: false });

  const {
    close: closeLabel = "Close",
    description = "Search...",
    emptyText = "No results found",
    pagesHeading = "Pages",
    placeholder = "Search...",
    title = "Search",
  } = labels;

  const closePalette = () => {
    close();
    void setQuery("");
  };

  const handleSelect = (url: string) => {
    closePalette();
    onSelect(url);
  };

  const filteredStaticPages = staticPages.filter((page) =>
    page.label.toLowerCase().includes((query ?? "").toLowerCase().trim()),
  );

  return (
    <CommandDialog
      className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
      closeLabel={closeLabel}
      description={description}
      onOpenChange={closePalette}
      open={isOpen}
      shouldFilter={false}
      title={title}
    >
      <CommandPaletteSearch placeholder={placeholder} queryParam={queryParam} />

      <CommandList>
        <CommandEmpty>
          <p>{emptyText}</p>
        </CommandEmpty>

        {children}

        {filteredStaticPages.length > 0 && (
          <CommandGroup heading={pagesHeading}>
            {filteredStaticPages.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => handleSelect(item.url)}
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
