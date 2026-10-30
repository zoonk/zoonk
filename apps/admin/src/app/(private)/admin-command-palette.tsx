"use client";

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogTitle,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { Kbd } from "@zoonk/ui/components/kbd";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { listenForCommandPaletteOpen } from "@zoonk/ui/lib/command-palette-event";
import { safeAsync } from "@zoonk/utils/error";
import { ArrowDownIcon, ArrowUpIcon, FileIcon, type LucideIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { searchAdminAction } from "./_actions/search-admin";
import { adminNavigation } from "./admin-navigation";

type PaletteItem = { detail?: string; href: Route; icon?: LucideIcon; label: string };
type PaletteGroup = { items: PaletteItem[]; label: string };

const PAGES = adminNavigation.flatMap((group) =>
  group.items.map(({ icon, label, url }) => ({ href: url, icon, label })),
);

const EMPTY_RESULTS: { error: boolean; groups: PaletteGroup[]; query: string } = {
  error: false,
  groups: [],
  query: "",
};

async function search(query: string) {
  const { data, error } = await safeAsync(() => searchAdminAction(query));
  return { error: Boolean(error), groups: data ?? [], query };
}

export function AdminCommandPalette() {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentUrl = `${pathname}${params.size > 0 ? `?${params.toString()}` : ""}`;
  return <Palette currentUrl={currentUrl} key={currentUrl} />;
}

function Palette({ currentUrl }: { currentUrl: string }) {
  const { closePalette, isOpen, isPending, open, query, results, returnFocusRef, setQuery } =
    useCommandPaletteSearch<typeof EMPTY_RESULTS>({
      emptyResults: EMPTY_RESULTS,
      onSearch: search,
    });

  useEffect(() => listenForCommandPaletteOpen(open), [open]);

  const trimmedQuery = query.trim();

  const pages = PAGES.filter((page) =>
    page.label.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );

  const searching = trimmedQuery.length >= 2 && (isPending || results.query !== trimmedQuery);
  const takingLong = useTakingLong({ active: searching, afterMs: 800 });
  const records = results.query === trimmedQuery ? results.groups : [];

  const groups = [{ items: pages, label: "Pages" }, ...records].filter(
    (group) => group.items.length,
  );

  const failed = results.query === trimmedQuery && results.error;
  const empty = groups.length === 0 && !searching && !failed;

  return (
    <CommandDialog
      finalFocus={returnFocusRef}
      onOpenChange={(nextOpen) => !nextOpen && closePalette()}
      open={isOpen}
    >
      <CommandDialogTitle>Search admin</CommandDialogTitle>
      <CommandDialogDescription>
        Go to a page or find a user, course, lesson or skill.
      </CommandDialogDescription>
      <Command
        autoHighlight="always"
        inline
        items={groups}
        itemToStringValue={(item: PaletteItem) => item.label}
        mode="none"
        onValueChange={setQuery}
        open
        value={query}
      >
        <CommandInput
          aria-label="Search pages and records"
          cancelLabel="Cancel"
          maxLength={100}
          placeholder="Search pages and records…"
        />
        <div
          aria-live="polite"
          className="text-muted-foreground h-7 shrink-0 px-4 py-1 text-xs"
          role="status"
        >
          {takingLong && "Searching…"}
          {!searching && failed && "Search couldn't load. Edit your search to retry."}
          {empty &&
            (trimmedQuery.length < 2
              ? "Type at least 2 characters to find records."
              : "No results found.")}
        </div>
        <CommandList className="min-h-[min(60vh,28rem)]">
          {groups.map((group) => (
            <CommandGroup items={group.items} key={group.label}>
              <CommandGroupLabel>{group.label}</CommandGroupLabel>
              <CommandCollection>
                {(item: PaletteItem) => (
                  <PaletteOption
                    closePalette={closePalette}
                    currentUrl={currentUrl}
                    item={item}
                    key={item.href}
                  />
                )}
              </CommandCollection>
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
      <CommandFooter>
        <span>
          <Kbd>
            <ArrowUpIcon />
          </Kbd>
          <Kbd>
            <ArrowDownIcon />
          </Kbd>{" "}
          move
        </span>
        <span>
          <Kbd>⏎</Kbd> open
        </span>
        <span>
          <Kbd>Esc</Kbd> close
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}

function PaletteOption({
  closePalette,
  currentUrl,
  item,
}: {
  closePalette: () => void;
  currentUrl: string;
  item: PaletteItem;
}) {
  const pathname = item.href.split("?")[0] ?? "";

  const parent = PAGES.find(
    (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
  );

  const Icon = item.icon ?? parent?.icon ?? FileIcon;

  return (
    <CommandItem
      onClick={(event) => {
        if (
          item.href === currentUrl &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          closePalette();
        }
      }}
      render={<Link href={item.href} prefetch />}
      value={item}
    >
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.detail && (
        <span className="text-muted-foreground max-w-[50%] truncate text-xs">{item.detail}</span>
      )}
    </CommandItem>
  );
}
