"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { getMenu } from "@/lib/menu";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogTitle,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@zoonk/ui/components/command";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useCallback } from "react";
import {
  type PaletteItem,
  createChapterPaletteItem,
  createCoursePaletteItem,
  createLogoutPaletteItem,
  createNavigationPaletteItem,
  getPaletteItemSearchValue,
  getVisiblePaletteGroups,
} from "./command-palette-items";
import { PaletteResultGroup } from "./command-palette-options";
import { type CatalogSearchResults, searchCatalogAction } from "./search-courses-action";

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
    (searchQuery: string) => searchCatalogAction({ language: locale, query: searchQuery }),
    [locale],
  );

  const { closePalette, isOpen, onSelectItem, open, query, results, setQuery } =
    useCommandPaletteSearch<CatalogSearchResults>({
      emptyResults: EMPTY_SEARCH_RESULTS,
      onSearch: handleSearch,
    });

  function handlePaletteItemSelect(item: PaletteItem) {
    if (item.kind === "logout") {
      closePalette();
      logout();
      return;
    }

    onSelectItem();

    if (item.kind === "navigation") {
      router.push(item.url);
      return;
    }

    if (item.kind === "course") {
      router.push(`/b/${item.course.brandSlug}/c/${item.course.slug}` as const);
      return;
    }

    router.push(
      `/b/${item.chapter.brandSlug}/c/${item.chapter.courseSlug}/ch/${item.chapter.slug}` as const,
    );
  }

  const searchLabel = t("Search");
  const searchPlaceholder = t("Search courses, chapters, or pages...");
  const paletteGroups = usePaletteGroups({ isLoggedIn, query, results });

  /**
   * The dialog may close from Escape or an outside press. The search hook owns
   * query/result reset, so close events should go through that single path.
   */
  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closePalette();
    }
  }

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        className={className}
        onClick={open}
        size="icon"
        variant="outline"
      >
        <SearchIcon aria-hidden="true" />
        <span className="sr-only">{searchLabel}</span>
      </Button>

      <CommandDialog onOpenChange={handleDialogOpenChange} open={isOpen}>
        <CommandDialogTitle>{searchLabel}</CommandDialogTitle>
        <CommandDialogDescription>{searchPlaceholder}</CommandDialogDescription>
        <Command
          autoHighlight="always"
          inline
          itemToStringValue={getPaletteItemSearchValue}
          items={paletteGroups}
          keepHighlight
          mode="none"
          onValueChange={setQuery}
          open
          value={query}
        >
          <CommandInput aria-label={searchLabel} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              <CreateCourseEmptyState onSelect={onSelectItem} query={query} />
            </CommandEmpty>

            {paletteGroups.map((group) => (
              <PaletteResultGroup
                group={group}
                key={group.id}
                onSelectItem={handlePaletteItemSelect}
              />
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

/**
 * Palette groups are assembled in a hook because translated labels must be read
 * with `t("literal")` at the render boundary, not passed through a translation
 * helper or stored outside the component.
 */
function usePaletteGroups({
  isLoggedIn,
  query,
  results,
}: {
  isLoggedIn: boolean;
  query: string;
  results: CatalogSearchResults;
}) {
  const t = useExtracted();

  const accountItems = isLoggedIn
    ? [
        createNavigationPaletteItem({
          id: "my-courses",
          label: t("My courses"),
          menu: getMenu("myCourses"),
        }),
        createNavigationPaletteItem({
          id: "subscription",
          label: t("Manage subscription"),
          menu: getMenu("subscription"),
        }),
        createNavigationPaletteItem({
          id: "update-language",
          label: t("Update language"),
          menu: getMenu("language"),
        }),
        createNavigationPaletteItem({
          id: "profile",
          label: t("Update profile"),
          menu: getMenu("profile"),
        }),
        createLogoutPaletteItem({ label: t("Logout") }),
      ]
    : [
        createNavigationPaletteItem({ id: "login", label: t("Login"), menu: getMenu("login") }),
        createNavigationPaletteItem({
          id: "language",
          label: t("Language"),
          menu: getMenu("language"),
        }),
      ];

  return getVisiblePaletteGroups({
    groups: [
      {
        id: "pages",
        items: [
          createNavigationPaletteItem({ id: "home", label: t("Home page"), menu: getMenu("home") }),
          createNavigationPaletteItem({
            id: "courses",
            label: t("Courses"),
            menu: getMenu("courses"),
          }),
          createNavigationPaletteItem({
            id: "start",
            label: t("Start a new course"),
            menu: getMenu("start"),
          }),
          createNavigationPaletteItem({
            id: "start-speak",
            label: t("Speak a language"),
            menu: getMenu("startSpeak"),
          }),
          createNavigationPaletteItem({
            id: "start-learn",
            label: t("Learn something"),
            menu: getMenu("startLearn"),
          }),
          createNavigationPaletteItem({
            id: "start-exam",
            label: t("Pass an exam"),
            menu: getMenu("startExam"),
          }),
        ],
        label: t("Pages"),
      },
      { id: "account", items: accountItems, label: t("My account") },
      {
        id: "help",
        items: [
          createNavigationPaletteItem({ id: "blog", label: t("Blog"), menu: getMenu("blog") }),
          createNavigationPaletteItem({
            id: "support",
            label: t("Feedback & Support"),
            menu: getMenu("support"),
          }),
        ],
        label: t("Help"),
      },
      { id: "courses", items: results.courses.map(createCoursePaletteItem), label: t("Courses") },
      {
        id: "chapters",
        items: results.chapters.map(createChapterPaletteItem),
        label: t("Chapters"),
      },
    ],
    query,
  });
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
          prefetch={false}
        >
          <PlusIcon aria-hidden="true" />
          <span className="min-w-0 wrap-break-word">
            {t("Create a course about {term}", { term: prompt })}
          </span>
        </Link>
      )}
    </div>
  );
}

/**
 * The palette input may contain only whitespace while the empty state is still
 * rendering, and the Learn route should only receive a real subject.
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
  return `/start/learn/${encodeURIComponent(prompt)}` as const;
}
