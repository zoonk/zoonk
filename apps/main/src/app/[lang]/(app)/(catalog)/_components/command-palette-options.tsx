"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { Link } from "@/i18n/navigation";
import {
  CommandCollection,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
} from "@zoonk/ui/components/command";
import { BookOpenIcon, LibraryIcon, type LucideIcon } from "lucide-react";
import { getPaletteItemHref } from "./command-palette-href";
import {
  type ChapterPaletteItem,
  type CoursePaletteItem,
  type PaletteGroup,
  type PaletteItem,
} from "./command-palette-items";

/**
 * Groups are rendered with Base UI's collection primitive so the active option
 * order used by keyboard navigation matches the visible grouped list.
 */
export function PaletteResultGroup({
  group,
  onSelectItem,
}: {
  group: PaletteGroup;
  onSelectItem: (item: PaletteItem) => void;
}) {
  return (
    <CommandGroup items={group.items}>
      <CommandGroupLabel>{group.label}</CommandGroupLabel>
      <CommandCollection>
        {(item: PaletteItem) => (
          <PaletteOption item={item} key={item.id} onSelectItem={onSelectItem} />
        )}
      </CommandCollection>
    </CommandGroup>
  );
}

/**
 * Each option delegates selection to Autocomplete.Item so pointer clicks and
 * Enter-key activation follow Base UI's combobox behavior on desktop and iOS.
 */
function PaletteOption({
  item,
  onSelectItem,
}: {
  item: PaletteItem;
  onSelectItem: (item: PaletteItem) => void;
}) {
  const href = getPaletteItemHref(item);

  const link = href ? <Link href={href} prefetch /> : undefined;

  return (
    <CommandItem
      onClick={(event) => {
        const destination = event.currentTarget.getAttribute("href");

        if (!href) {
          onSelectItem(item);
        } else if (
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          isCurrentDestination(destination)
        ) {
          event.preventDefault();
          onSelectItem(item);
        }
      }}
      render={item.kind === "navigation" && item.id === "login" ? <CurrentPageLoginLink /> : link}
      value={item}
    >
      <PaletteOptionContent item={item} />
    </CommandItem>
  );
}

/** Match the URL key's query encoding, including spaces encoded as either `+` or `%20`. */
function isCurrentDestination(destination: string | null): boolean {
  if (!destination) {
    return false;
  }

  const current = new URL(globalThis.location.href);
  const target = new URL(destination, current);

  return (
    target.origin === current.origin &&
    target.pathname === current.pathname &&
    target.searchParams.toString() === current.searchParams.toString()
  );
}

/**
 * Catalog results share the command row rhythm: a course has the library's mark, as the Plan's
 * related courses do, and a chapter a book with its course as context.
 */
function PaletteOptionContent({ item }: { item: PaletteItem }) {
  if (item.kind === "course") {
    return <CatalogOptionContent icon={LibraryIcon} title={item.course.title} />;
  }

  if (item.kind === "chapter") {
    return (
      <CatalogOptionContent
        courseName={item.chapter.courseTitle}
        icon={BookOpenIcon}
        title={item.chapter.title}
      />
    );
  }

  return <SimpleOptionContent item={item} />;
}

/**
 * A compact row: its icon and name, a chip right after the name ("full, half or one subject",
 * from `sm`), and at its end a quiet line ("Porcentagem e descontos · 5 min") or a count.
 */
function SimpleOptionContent({
  item,
}: {
  item: Exclude<PaletteItem, ChapterPaletteItem | CoursePaletteItem>;
}) {
  const { chip, count, icon: Icon, meta } = item;

  return (
    <>
      <Icon aria-hidden="true" />

      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">{item.label}</span>
        {chip && (
          <span className="text-muted-foreground ring-border hidden h-5.5 shrink-0 items-center rounded-md px-2 text-[0.71875rem] font-medium ring-1 ring-inset sm:inline-flex">
            {chip}
          </span>
        )}
      </span>

      {meta && <span className="text-muted-foreground max-w-[45%] truncate text-xs">{meta}</span>}

      {Boolean(count) && (
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{count}</span>
      )}
    </>
  );
}

/** A chapter's parent course stays available to assistive technology when visually truncated. */
function CatalogOptionContent({
  courseName,
  icon: Icon,
  title,
}: {
  courseName?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <>
      <Icon aria-hidden="true" className="size-4" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {courseName && (
        <span className="text-muted-foreground max-w-[45%] truncate text-xs">{courseName}</span>
      )}
    </>
  );
}
