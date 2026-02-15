"use client";

import { type ResultWithImage, type SearchResults, searchContent } from "@/data/search-content";
import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import {
  BookOpenIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  LogOutIcon,
  type LucideIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

const emptyResults: SearchResults = {
  chapters: [],
  courses: [],
  lessons: [],
};

export function CommandPalette() {
  const t = useExtracted();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (!orgSlug) {
        return Promise.resolve(emptyResults);
      }
      return searchContent({ orgSlug, title: searchQuery });
    },
    [orgSlug],
  );

  const { closePalette, isOpen, onSelectItem, open, query, results, setQuery } =
    useCommandPaletteSearch<SearchResults>({
      emptyResults,
      onSearch: handleSearch,
    });

  const handleSelect = (url: string) => {
    onSelectItem();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dynamic internal routes require assertion
    router.push(url as never);
  };

  const staticItems: {
    icon: LucideIcon;
    id: string;
    keywords: string[];
    label: string;
    url: string;
  }[] = useMemo(
    () => [
      {
        icon: HomeIcon,
        id: "home",
        keywords: [t("home"), t("dashboard"), t("start")],
        label: t("Home page"),
        url: `/${orgSlug}`,
      },
      {
        icon: PlusIcon,
        id: "create-course",
        keywords: [t("new"), t("add"), t("create"), t("course")],
        label: t("Create course"),
        url: `/${orgSlug}/new-course`,
      },
      {
        icon: LogOutIcon,
        id: "logout",
        keywords: [t("logout"), t("sign out"), t("exit")],
        label: t("Logout"),
        url: "/logout",
      },
    ],
    [orgSlug, t],
  );

  const hasCourses = results.courses.length > 0;
  const hasChapters = results.chapters.length > 0;
  const hasLessons = results.lessons.length > 0;

  return (
    <>
      <Button aria-keyshortcuts="Meta+K Control+K" onClick={open} size="icon" variant="outline">
        <SearchIcon aria-hidden="true" />
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        description={t("Search courses, chapters, lessons, or pages...")}
        onOpenChange={closePalette}
        open={isOpen}
        title={t("Search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("Search courses, chapters, lessons, or pages...")}
          value={query}
        />

        <CommandList>
          <CommandEmpty>
            <p>{t("No results found")}</p>
          </CommandEmpty>

          {/* Static pages - always shown, filtered by cmdk */}
          <CommandGroup heading={t("Pages")}>
            {staticItems.map((item) => (
              <CommandItem
                key={item.id}
                keywords={item.keywords}
                onSelect={() => handleSelect(item.url)}
                value={`${item.label}-${item.id}`}
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {/* Dynamic results - only shown when there are search results */}
          {hasCourses && (
            <CommandGroup heading={t("Courses")}>
              {results.courses.map((course) => (
                <CourseItem course={course} key={course.id} onSelect={handleSelect} />
              ))}
            </CommandGroup>
          )}

          {hasChapters && (
            <CommandGroup heading={t("Chapters")}>
              {results.chapters.map((chapter) => (
                <PositionedItem
                  description={chapter.description}
                  icon={FolderIcon}
                  id={chapter.id}
                  key={chapter.id}
                  onSelect={() => handleSelect(chapter.url)}
                  position={chapter.position}
                  title={chapter.title}
                />
              ))}
            </CommandGroup>
          )}

          {hasLessons && (
            <CommandGroup heading={t("Lessons")}>
              {results.lessons.map((lesson) => (
                <PositionedItem
                  description={lesson.description}
                  icon={FileTextIcon}
                  id={lesson.id}
                  key={lesson.id}
                  onSelect={() => handleSelect(lesson.url)}
                  position={lesson.position}
                  title={lesson.title}
                />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function CourseItem({
  course,
  onSelect,
}: {
  course: ResultWithImage;
  onSelect: (url: string) => void;
}) {
  return (
    <CommandItem
      className="flex items-start gap-3"
      onSelect={() => onSelect(course.url)}
      value={`${course.title}-${course.id}`}
    >
      {course.imageUrl ? (
        <Image
          alt={course.title}
          className="size-8 shrink-0 rounded-md object-cover"
          height={32}
          src={course.imageUrl}
          width={32}
        />
      ) : (
        <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
          <BookOpenIcon aria-hidden="true" className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{course.title}</p>
        {course.description && (
          <p className="text-muted-foreground truncate text-xs">{course.description}</p>
        )}
      </div>
    </CommandItem>
  );
}

/**
 * Generic item component for chapters and lessons.
 * Shows a position number badge with an icon and title/description.
 */
function PositionedItem({
  description,
  icon: Icon,
  id,
  onSelect,
  position,
  title,
}: {
  description: string | null;
  icon: LucideIcon;
  id: number;
  onSelect: () => void;
  position: number;
  title: string;
}) {
  return (
    <CommandItem className="flex items-start gap-3" onSelect={onSelect} value={`${title}-${id}`}>
      <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-medium">
        {position}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <p className="truncate font-medium">{title}</p>
        </div>

        {description && <p className="text-muted-foreground truncate text-xs">{description}</p>}
      </div>
    </CommandItem>
  );
}
