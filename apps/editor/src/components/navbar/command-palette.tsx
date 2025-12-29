"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import {
  BookOpenIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  LanguagesIcon,
  LogOutIcon,
  type LucideIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import {
  type SearchResultCourse,
  type SearchResults,
  searchContent,
} from "@/data/search-content";

type StaticMenuItem = {
  icon: LucideIcon;
  id: string;
  keywords: string[];
  label: string;
  url: string;
};

export function CommandPalette() {
  const t = useExtracted();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    chapters: [],
    courses: [],
    lessons: [],
  });

  const deferredQuery = useDeferredValue(query);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useKeyboardCallback("k", () => setIsOpen((prev) => !prev), {
    mode: "any",
    modifiers: { ctrlKey: true, metaKey: true },
  });

  const open = () => setIsOpen(true);

  const closePalette = () => {
    setIsOpen(false);
    setQuery("");
    setResults({ chapters: [], courses: [], lessons: [] });
  };

  const onSelectItem = (url: string) => {
    closePalette();
    router.push(url as Parameters<typeof router.push>[0]);
  };

  // Fetch search results when query changes
  useEffect(() => {
    if (!(deferredQuery.trim() && orgSlug)) {
      setResults({ chapters: [], courses: [], lessons: [] });
      return;
    }

    setIsLoading(true);

    startTransition(() => {
      searchContent({ orgSlug, title: deferredQuery })
        .then(setResults)
        .finally(() => setIsLoading(false));
    });
  }, [deferredQuery, orgSlug]);

  const staticItems: StaticMenuItem[] = [
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
      icon: LanguagesIcon,
      id: "language",
      keywords: [t("language"), t("translate"), t("locale"), t("settings")],
      label: t("Language"),
      url: "/language",
    },
    {
      icon: LogOutIcon,
      id: "logout",
      keywords: [t("logout"), t("sign out"), t("exit")],
      label: t("Logout"),
      url: "/logout",
    },
  ];

  const hasCourses = results.courses.length > 0;
  const hasChapters = results.chapters.length > 0;
  const hasLessons = results.lessons.length > 0;
  const hasDynamicResults = hasCourses || hasChapters || hasLessons;

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
        size="icon"
        variant="outline"
      >
        <SearchIcon aria-hidden="true" />
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
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
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner />
                <span>{t("Searching...")}</span>
              </div>
            ) : (
              <p>{t("No results found")}</p>
            )}
          </CommandEmpty>

          {/* Static pages - always shown, filtered by cmdk */}
          <CommandGroup heading={t("Pages")}>
            {staticItems.map((item) => (
              <CommandItem
                key={item.id}
                keywords={item.keywords}
                onSelect={() => onSelectItem(item.url)}
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
                <CourseItem
                  course={course}
                  key={course.id}
                  onSelect={onSelectItem}
                />
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
                  onSelect={() => onSelectItem(chapter.url)}
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
                  onSelect={() => onSelectItem(lesson.url)}
                  position={lesson.position}
                  title={lesson.title}
                />
              ))}
            </CommandGroup>
          )}

          {/* Loading indicator for dynamic results */}
          {isLoading && query.trim() && !hasDynamicResults && (
            <div className="p-4">
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
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
  course: SearchResultCourse;
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
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <BookOpenIcon aria-hidden="true" className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{course.title}</p>
        {course.description && (
          <p className="truncate text-muted-foreground text-xs">
            {course.description}
          </p>
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
    <CommandItem
      className="flex items-start gap-3"
      onSelect={onSelect}
      value={`${title}-${id}`}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-sm">
        {position}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <p className="truncate font-medium">{title}</p>
        </div>

        {description && (
          <p className="truncate text-muted-foreground text-xs">
            {description}
          </p>
        )}
      </div>
    </CommandItem>
  );
}
