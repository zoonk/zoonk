"use client";

import { logout } from "@/lib/logout";
import { getMenu } from "@/lib/menu";
import { trackCommandPaletteSearch } from "@/lib/track-events";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import { BookOpenIcon, LogOut, PlusIcon, Search } from "lucide-react";
import { type Route } from "next";
import { useExtracted, useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  type CatalogSearchResults,
  type ChapterSearchResult,
  type CourseSearchResult,
  searchCatalogAction,
} from "./search-courses-action";

const EMPTY_SEARCH_RESULTS: CatalogSearchResults = { chapters: [], courses: [] };

/**
 * The catalog navbar sometimes hides the search trigger responsively while the
 * dialog logic stays unchanged. Accepting a trigger class keeps that layout
 * concern out of the command palette state and search behavior.
 */
export function CommandPalette({
  className,
  isLoggedIn,
}: {
  className?: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const t = useExtracted();
  const locale = useLocale();

  const handleSearch = useCallback(
    (searchQuery: string) => {
      trackCommandPaletteSearch({ searchTerm: searchQuery });

      return searchCatalogAction({ language: locale, query: searchQuery });
    },
    [locale],
  );

  const { closePalette, isOpen, onSelectItem, open, query, results, setQuery } =
    useCommandPaletteSearch<CatalogSearchResults>({
      emptyResults: EMPTY_SEARCH_RESULTS,
      onSearch: handleSearch,
    });

  function handleSelect<T extends string>(url: Route<T>) {
    onSelectItem();
    router.push(url);
  }

  const getStarted = [
    { key: t("Home page"), ...getMenu("home") },
    { key: t("Courses"), ...getMenu("courses") },
    { key: t("Learn something"), ...getMenu("learn") },
  ];

  const accountPublic = [
    { key: t("Login"), ...getMenu("login") },
    { key: t("Language"), ...getMenu("language") },
  ];

  const accountPrivate = [
    { key: t("My courses"), ...getMenu("myCourses") },
    { key: t("Manage subscription"), ...getMenu("subscription") },
    { key: t("Update language"), ...getMenu("language") },
    { key: t("Update profile"), ...getMenu("profile") },
  ];

  const contactUs = [
    { key: t("Blog"), ...getMenu("blog") },
    { key: t("Feedback & Support"), ...getMenu("support") },
  ];

  const hasChapters = results.chapters.length > 0;
  const hasCourses = results.courses.length > 0;

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        className={className}
        onClick={open}
        size="icon"
        variant="outline"
      >
        <Search aria-hidden="true" />
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        description={t("Search courses, chapters, or pages...")}
        onOpenChange={closePalette}
        open={isOpen}
        title={t("Search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("Search courses, chapters, or pages...")}
          value={query}
        />

        <CommandList>
          <CommandEmpty>
            <CreateCourseEmptyState onSelect={onSelectItem} query={query} />
          </CommandEmpty>

          <CommandGroup heading={t("Pages")}>
            {getStarted.map((item) => (
              <CommandItem key={item.key} onSelect={() => handleSelect(item.url)}>
                <item.icon aria-hidden="true" />
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading={t("My account")}>
            {!isLoggedIn &&
              accountPublic.map((item) => (
                <CommandItem key={item.key} onSelect={() => handleSelect(item.url)}>
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}

            {isLoggedIn &&
              accountPrivate.map((item) => (
                <CommandItem key={item.key} onSelect={() => handleSelect(item.url)}>
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}

            {isLoggedIn && (
              <CommandItem
                onSelect={() => {
                  closePalette();
                  logout();
                }}
              >
                <LogOut aria-hidden="true" />
                {t("Logout")}
              </CommandItem>
            )}
          </CommandGroup>

          <CommandGroup heading={t("Help")}>
            {contactUs.map((item) => (
              <CommandItem key={item.key} onSelect={() => handleSelect(item.url)}>
                <item.icon aria-hidden="true" />
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>

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
                <ChapterItem chapter={chapter} key={chapter.id} onSelect={handleSelect} />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

/**
 * Empty palette searches usually mean the learner asked for something Zoonk
 * cannot find yet, so the dead end should lead into the same prompt-based
 * creation flow used by the Learn page.
 */
function CreateCourseEmptyState({ onSelect, query }: { onSelect: () => void; query: string }) {
  const t = useExtracted();
  const prompt = getCreateCoursePrompt(query);

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <p className="text-muted-foreground">{t("No results found")}</p>

      {prompt && (
        <Link
          className={buttonVariants({
            className:
              "h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-center leading-snug",
            size: "sm",
            variant: "outline",
          })}
          href={getLearnPromptHref(prompt)}
          onClick={onSelect}
        >
          <PlusIcon aria-hidden="true" />
          <span className="min-w-0 wrap-break-word">
            {t("Create {term} course", { term: prompt })}
          </span>
        </Link>
      )}
    </div>
  );
}

/**
 * The palette input may contain only whitespace while cmdk is still rendering
 * an empty result, and the Learn route should only receive a real subject.
 */
function getCreateCoursePrompt(query: string) {
  const prompt = query.trim();

  if (!prompt) {
    return null;
  }

  return prompt;
}

/**
 * The Learn prompt is stored in a dynamic path segment, so the raw search term
 * must be encoded before it is sent through Next.js navigation.
 */
function getLearnPromptHref(prompt: string) {
  return `/learn/${encodeURIComponent(prompt)}` as const;
}

function CourseItem({
  course,
  onSelect,
}: {
  course: CourseSearchResult;
  onSelect: <T extends string>(url: Route<T>) => void;
}) {
  return (
    <CommandItem
      className="flex items-start gap-3"
      onSelect={() => onSelect(`/b/${course.brandSlug}/c/${course.slug}`)}
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
 * Chapter results need to carry their parent course context because chapter
 * titles are often reused across courses. Including the course and description
 * in the command value also lets cmdk keep description-only server matches
 * visible after its local filtering runs.
 */
function ChapterItem({
  chapter,
  onSelect,
}: {
  chapter: ChapterSearchResult;
  onSelect: <T extends string>(url: Route<T>) => void;
}) {
  return (
    <CommandItem
      className="flex items-start gap-3"
      onSelect={() =>
        onSelect(`/b/${chapter.brandSlug}/c/${chapter.courseSlug}/ch/${chapter.slug}`)
      }
      value={[chapter.title, chapter.courseTitle, chapter.description, chapter.id]
        .filter(Boolean)
        .join(" ")}
    >
      {chapter.imageUrl ? (
        <Image
          alt={chapter.title}
          className="size-8 shrink-0 rounded-md object-cover"
          height={32}
          src={chapter.imageUrl}
          width={32}
        />
      ) : (
        <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
          <BookOpenIcon aria-hidden="true" className="size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{chapter.title}</p>
        <p className="text-muted-foreground truncate text-xs">{chapter.courseTitle}</p>
        <p className="text-muted-foreground truncate text-xs">{chapter.description}</p>
      </div>
    </CommandItem>
  );
}
