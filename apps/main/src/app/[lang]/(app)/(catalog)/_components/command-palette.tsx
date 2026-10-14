"use client";

import { usePathname } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { openNextStudyBlockAction } from "@/lib/session/study-session-actions";
import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { useContentFeedback } from "@zoonk/learn/feedback";
import { useGoalSwitchTransition } from "@zoonk/learn/goal-switcher";
import {
  Command,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogTitle,
  CommandFooter,
  CommandInput,
  CommandList,
} from "@zoonk/ui/components/command";
import { Kbd } from "@zoonk/ui/components/kbd";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useTransition } from "react";
import { listenForCommandPaletteOpen } from "./command-palette-event";
import { usePaletteGroups } from "./command-palette-groups";
import { type PaletteItem, getPaletteItemSearchValue } from "./command-palette-items";
import { type LearnerPalette } from "./command-palette-learner-groups";
import { PaletteResultGroup } from "./command-palette-options";
import { type PaletteSearchResults, searchPaletteAction } from "./search-courses-action";

const EMPTY_SEARCH_RESULTS: PaletteSearchResults = {
  catalog: { chapters: [], courses: [] },
  mocks: [],
  plan: { chapters: [], subjects: [] },
};

/**
 * Opens the day's next block from the palette, as Today's Continue does: the palette has closed by
 * then, so a block that couldn't be opened says so in a toast.
 */
function useContinueFromPalette() {
  const t = useExtracted();
  const go = useGoToStudyDestination();
  const [, startTransition] = useTransition();

  return (sessionId: string) => {
    startTransition(async () => {
      const destination = await openNextStudyBlockAction({
        sessionId,
        timeZone: getLocalTimeZone(),
      });

      const opened = await go(destination);

      if (!opened) {
        showErrorToast(t("Couldn't open your next step. Try again."));
      }
    });
  };
}

/**
 * Cmd/Ctrl+K search, commands and questions, the app's one search: the shortcut, the search field
 * (the sidebar's, the phone's under the top bar) and the account menu's "Search" open it. Anyone
 * with a session gets their actions, places and other goals (`learner`), and can ask the buddy
 * whatever they type; a visitor gets the public pages.
 */
type CommandPaletteProps = { isLoggedIn: boolean; learner?: LearnerPalette };

export function CommandPalette(props: CommandPaletteProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The selected Link stays mounted while Next.js prepares its navigation; the committed URL
  // resets the dialog and search together, including navigations that only change the query.
  return <Palette key={`${pathname}?${searchParams.toString()}`} {...props} />;
}

function Palette({ isLoggedIn, learner }: CommandPaletteProps) {
  const t = useExtracted();
  const locale = useLocale();
  const contentFeedback = useContentFeedback();
  const [, startGoalSwitch] = useGoalSwitchTransition();
  const continueSession = useContinueFromPalette();

  const handleSearch = useCallback(
    (searchQuery: string) => searchPaletteAction({ language: locale, query: searchQuery }),
    [locale],
  );

  const { closePalette, isOpen, onSelectItem, open, query, results, setQuery } =
    useCommandPaletteSearch<PaletteSearchResults>({
      emptyResults: EMPTY_SEARCH_RESULTS,
      onSearch: handleSearch,
    });

  /** The search fields and the account menu's "Search" open this palette too. */
  useEffect(() => listenForCommandPaletteOpen(open), [open]);

  function runPaletteItem(item: PaletteItem) {
    if (item.kind === "logout") {
      void logout();
      return;
    }

    if (item.kind === "feedback") {
      contentFeedback?.openFeedbackForm({
        context: { screen: "command-palette" },
        isReport: false,
      });

      return;
    }

    if (item.kind === "goal") {
      startGoalSwitch(async () => {
        await learner?.onSwitchGoal(item.goalId);
      });

      return;
    }

    if (item.kind === "continue") {
      continueSession(item.sessionId);
    }
  }

  function handlePaletteItemSelect(item: PaletteItem) {
    onSelectItem();
    runPaletteItem(item);
  }

  const paletteGroups = usePaletteGroups({ isLoggedIn, learner, query, results });

  /**
   * The dialog may close from Escape, Cancel or an outside press. The search hook owns
   * query/result reset, so close events should go through that single path.
   */
  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closePalette();
    }
  }

  return (
    <CommandDialog onOpenChange={handleDialogOpenChange} open={isOpen}>
      <CommandDialogTitle>{t("Search or ask")}</CommandDialogTitle>
      <CommandDialogDescription>
        {t("Go to a page, run an action or ask a question.")}
      </CommandDialogDescription>
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
        <CommandInput
          aria-label={t("Search or ask")}
          cancelLabel={t("Cancel")}
          placeholder={t("Search or ask…")}
        />
        <CommandList>
          {paletteGroups.map((group) => (
            <PaletteResultGroup
              group={group}
              key={group.id}
              onSelectItem={handlePaletteItemSelect}
            />
          ))}
        </CommandList>
      </Command>

      <PaletteFooter />
    </CommandDialog>
  );
}

/** The keys the palette answers to, where there's a keyboard. */
function PaletteFooter() {
  const t = useExtracted();

  return (
    <CommandFooter>
      <span>
        <Kbd>
          <ArrowUpIcon />
        </Kbd>
        <Kbd>
          <ArrowDownIcon />
        </Kbd>
        {t("move")}
      </span>
      <span>
        <Kbd>⏎</Kbd>
        {t("open")}
      </span>
      <span>
        <Kbd>Esc</Kbd>
        {t("close")}
      </span>
    </CommandFooter>
  );
}
