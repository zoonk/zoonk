"use client";

import {
  CommandCollection,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
} from "@zoonk/ui/components/command";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon } from "lucide-react";
import Image from "next/image";
import {
  type ChapterPaletteItem,
  type CoursePaletteItem,
  type LogoutPaletteItem,
  type NavigationPaletteItem,
  type PaletteGroup,
  type PaletteItem,
  isDetailedPaletteItem,
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
  return (
    <CommandItem
      className={cn(isDetailedPaletteItem(item) && "gap-3")}
      onClick={() => onSelectItem(item)}
      value={item}
    >
      <PaletteOptionContent item={item} />
    </CommandItem>
  );
}

/**
 * Course and chapter results need richer media/text layouts, while static
 * navigation actions should stay visually compact like regular command items.
 */
function PaletteOptionContent({ item }: { item: PaletteItem }) {
  if (item.kind === "course") {
    return <CourseOptionContent item={item} />;
  }

  if (item.kind === "chapter") {
    return <ChapterOptionContent item={item} />;
  }

  return <SimpleOptionContent item={item} />;
}

/**
 * Simple command items use the menu icon and label only, matching the compact
 * page/account/help actions from the previous palette.
 */
function SimpleOptionContent({ item }: { item: LogoutPaletteItem | NavigationPaletteItem }) {
  const Icon = item.icon;

  return (
    <>
      <Icon aria-hidden="true" />
      {item.label}
    </>
  );
}

/**
 * Course results show the thumbnail when available so search results remain
 * recognizable without requiring learners to inspect the destination URL.
 */
function CourseOptionContent({ item }: { item: CoursePaletteItem }) {
  const { course } = item;

  return (
    <>
      <PaletteResultImage imageUrl={course.imageUrl} title={course.title} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{course.title}</p>
        {course.description && (
          <p className="text-muted-foreground truncate text-xs">{course.description}</p>
        )}
      </div>
    </>
  );
}

/**
 * Chapter results include the parent course because the same chapter title can
 * appear in multiple courses.
 */
function ChapterOptionContent({ item }: { item: ChapterPaletteItem }) {
  const { chapter } = item;

  return (
    <>
      <PaletteResultImage imageUrl={chapter.imageUrl} title={chapter.title} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{chapter.title}</p>
        <p className="text-muted-foreground truncate text-xs">{chapter.courseTitle}</p>
        <p className="text-muted-foreground truncate text-xs">{chapter.description}</p>
      </div>
    </>
  );
}

/**
 * Catalog records do not always have thumbnails, so the fallback keeps result
 * rows aligned while still communicating that the destination is course content.
 */
function PaletteResultImage({ imageUrl, title }: { imageUrl: string | null; title: string }) {
  if (imageUrl) {
    return (
      <Image
        alt={title}
        className="size-8 shrink-0 rounded-md object-cover"
        height={32}
        src={imageUrl}
        width={32}
      />
    );
  }

  return (
    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
      <BookOpenIcon aria-hidden="true" className="size-4" />
    </div>
  );
}
