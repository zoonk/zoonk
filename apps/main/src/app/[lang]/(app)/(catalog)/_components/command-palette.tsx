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
import { useCallback, useEffect, useState, useTransition } from "react";
import { listenForCommandPaletteOpen } from "./command-palette-event";
import { usePaletteGroups } from "./command-palette-groups";
import { keepsRowsThrough } from "./command-palette-highlight";
import { type PaletteItem, getPaletteItemSearchValue } from "./command-palette-items";
import { type LearnerPalette, UNREAD_LEARNER_PALETTE } from "./command-palette-learner-groups";
import { PaletteResultGroup } from "./command-palette-options";
import { type PaletteSearchResults, searchPaletteAction } from "./search-courses-action";

const EMPTY_SEARCH_RESULTS: PaletteSearchResults = {
  catalog: { chapters: [], courses: [] },
  mocks: [],
  plan: { chapters: [], subjects: [] },
};

/** The palette has closed by then, so a block that couldn't be opened says so in a toast. */
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

type CommandPaletteProps = { isLoggedIn: boolean; learner?: LearnerPalette };

/**
 * The palette keeps its highlight by index, so learner rows that would land at or above it wait until
 * the learner types or opens it again; otherwise Enter would open something else.
 */
function useShownPalette({
  highlighted,
  isLoggedIn,
  isOpen,
  learner,
  query,
  results,
}: CommandPaletteProps & {
  highlighted: number;
  isOpen: boolean;
  query: string;
  results: PaletteSearchResults;
}) {
  const [shown, setShown] = useState({ learner, query });
  const unread = { isLoggedIn: false, learner: UNREAD_LEARNER_PALETTE };
  const unreadGroups = usePaletteGroups({ ...unread, query, results });
  const learnerGroups = usePaletteGroups({ isLoggedIn, learner, query, results });

  const waits =
    isOpen &&
    query === shown.query &&
    shown.learner === UNREAD_LEARNER_PALETTE &&
    learner !== undefined &&
    !keepsRowsThrough({ highlighted, next: learnerGroups, shown: unreadGroups });

  if (!waits && (shown.learner !== learner || shown.query !== query)) {
    setShown({ learner, query });
  }

  return waits
    ? { groups: unreadGroups, learner: unread.learner }
    : { groups: learnerGroups, learner };
}

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

  useEffect(() => listenForCommandPaletteOpen(open), [open]);

  const [highlighted, setHighlighted] = useState(-1);

  const shown = useShownPalette({ highlighted, isLoggedIn, isOpen, learner, query, results });

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
        await shown.learner?.onSwitchGoal(item.goalId);
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

  /** The search hook owns the query and results reset, so every close goes through it. */
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
        items={shown.groups}
        keepHighlight
        mode="none"
        onItemHighlighted={(_item, { index }) => setHighlighted(index)}
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
          {shown.groups.map((group) => (
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
