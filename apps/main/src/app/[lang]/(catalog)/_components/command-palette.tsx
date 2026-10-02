"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { type CatalogSearchResults } from "@zoonk/core/catalog/search";
import { useContentFeedback } from "@zoonk/learn/feedback";
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
import { useCallback, useTransition } from "react";
import { type LearnerPalette, usePaletteGroups } from "./command-palette-groups";
import { type PaletteItem, getPaletteItemSearchValue } from "./command-palette-items";
import { PaletteResultGroup } from "./command-palette-options";
import { searchCatalogAction } from "./search-courses-action";

const EMPTY_SEARCH_RESULTS: CatalogSearchResults = { chapters: [], courses: [] };

/**
 * Cmd/Ctrl+K search and navigation for every frame. The catalog shows its pages; the learning tabs
 * (`learner`) show the learner's places in their mode's names and their other goals instead.
 */
export function CommandPalette({
  isLoggedIn,
  learner,
  triggerClassName,
}: {
  isLoggedIn: boolean;
  learner?: LearnerPalette;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const t = useExtracted();
  const locale = useLocale();
  const contentFeedback = useContentFeedback();
  const [, startGoalSwitch] = useTransition();

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
      void logout();
      return;
    }

    if (item.kind === "feedback") {
      closePalette();

      contentFeedback?.openFeedbackForm({
        context: { screen: "command-palette" },
        isReport: false,
      });

      return;
    }

    if (item.kind === "goal") {
      closePalette();

      startGoalSwitch(async () => {
        await learner?.onSwitchGoal(item.goalId);
      });

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
  const searchPlaceholder = t("Search courses, chapters, or pages…");
  const paletteGroups = usePaletteGroups({ isLoggedIn, learner, query, results });

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
        className={triggerClassName}
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
 * Empty palette searches usually mean the learner asked for something Zoonk
 * cannot find yet, so the dead end leads into onboarding with the search as the
 * goal.
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
          href={getGoalStartHref(prompt)}
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
 * rendering, and onboarding should only receive a real goal.
 */
function getCreateCoursePrompt(query: string) {
  const prompt = query.trim();

  if (!prompt) {
    return null;
  }

  return prompt;
}
