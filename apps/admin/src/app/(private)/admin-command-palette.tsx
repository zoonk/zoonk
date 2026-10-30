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
import { safeAsync } from "@zoonk/utils/error";
import { ArrowDownIcon, ArrowUpIcon, FileIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { searchAdminAction } from "./search-admin-action";

type PaletteItem = { detail?: string; href: Route; label: string };
type PaletteGroup = { items: PaletteItem[]; label: string };

const PAGES: PaletteItem[] = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
  { href: "/feedback/messages", label: "Feedback" },
  { href: "/ai", label: "AI" },
  { href: "/live-calls", label: "Live calls" },
  { href: "/users", label: "Users" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/account-deletions", label: "Account deletions" },
  { href: "/courses", label: "Courses" },
  { href: "/lessons", label: "Lessons" },
  { href: "/questions", label: "Questions" },
  { href: "/skills", label: "Skills" },
  { href: "/items", label: "Items" },
  { href: "/sources", label: "Sources" },
  { href: "/exams", label: "Exams" },
  { href: "/media", label: "Media" },
  { href: "/review-flags", label: "Needs review" },
];

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
  const { closePalette, isOpen, isPending, query, results, setQuery } = useCommandPaletteSearch({
    emptyResults: EMPTY_RESULTS,
    onSearch: search,
  });

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
    <CommandDialog onOpenChange={(open) => !open && closePalette()} open={isOpen}>
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
          to navigate
        </span>
        <span>
          <Kbd>↵</Kbd> to open
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
      <FileIcon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.detail && (
        <span className="text-muted-foreground max-w-[50%] truncate text-xs">{item.detail}</span>
      )}
    </CommandItem>
  );
}
