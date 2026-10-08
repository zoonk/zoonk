"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { useLocale } from "next-intl";
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { ContentFeedbackContext, type ContentFeedbackContextValue } from "./feedback-context";
import {
  type ContentFeedbackAdapters,
  type ContentVoteValue,
  type FeedbackFormRequest,
  getVoteKey,
} from "./feedback-contract";
import { useScreenKeysPause } from "./use-screen-keys-pause";

/**
 * The sheet and the form load the first time someone opens them, so pages where nobody leaves
 * feedback don't ship their code.
 */
const DownvoteSheet = lazy(() =>
  import("./downvote-sheet").then((module) => ({ default: module.DownvoteSheet })),
);

const FeedbackFormDialog = lazy(() =>
  import("./feedback-form-dialog").then((module) => ({ default: module.FeedbackFormDialog })),
);

export type { ContentFeedbackAdapters } from "./feedback-contract";
export { useContentFeedback } from "./feedback-context";

/** True from the first time `isOpen` is true, so a lazy part stays mounted and can animate closed. */
function useOpenedOnce(isOpen: boolean): boolean {
  const [opened, setOpened] = useState(isOpen);

  if (isOpen && !opened) {
    setOpened(true);
  }

  return opened || isOpen;
}

function useVoteStore(adapters: ContentFeedbackAdapters) {
  const [votes, setVotes] = useState<Record<string, ContentVoteValue | null>>({});
  const requested = useRef(new Set<string>());

  const getVote = useCallback((target: ContentVoteTarget) => votes[getVoteKey(target)], [votes]);

  const setVote = useCallback((target: ContentVoteTarget, vote: ContentVoteValue) => {
    requested.current.add(getVoteKey(target));
    setVotes((current) => ({ ...current, [getVoteKey(target)]: vote }));
  }, []);

  /** Menus unmount when they close, so votes live here and each one is read once. */
  const loadVote = useCallback(
    (target: ContentVoteTarget) => {
      const key = getVoteKey(target);

      if (requested.current.has(key)) {
        return;
      }

      requested.current.add(key);

      void adapters.readVote(target).then((vote) => {
        setVotes((current) => (key in current ? current : { ...current, [key]: vote }));
      });
    },
    [adapters],
  );

  return { getVote, loadVote, setVote };
}

/** Which vote menus are open, so the screen under them can pause its keys. */
function useOpenMenus() {
  const [openMenus, setOpenMenus] = useState<readonly string[]>([]);

  const setMenuOpen = useCallback(({ menuId, open }: { menuId: string; open: boolean }) => {
    setOpenMenus((current) => {
      const others = current.filter((id) => id !== menuId);
      return open ? [...others, menuId] : others;
    });
  }, []);

  return { anyMenuOpen: openMenus.length > 0, setMenuOpen };
}

/**
 * Makes feedback available to every screen below it: the vote entries in screen menus, thumbs, the
 * light downvote sheet and the message form. The sheet and the form live here, outside any menu,
 * so they stay open after the menu that opened them closes. While a vote menu, the sheet or the
 * form is open, the screen's own keys pause. Keep `adapters` stable.
 */
export function ContentFeedbackProvider({
  adapters,
  children,
}: {
  adapters: ContentFeedbackAdapters;
  children: React.ReactNode;
}) {
  const language = useLocale();
  const { getVote, loadVote, setVote } = useVoteStore(adapters);
  const [downvoted, setDownvoted] = useState<ContentVoteTarget | null>(null);
  const [formRequest, setFormRequest] = useState<FeedbackFormRequest | null>(null);
  const showDownvoteSheet = useOpenedOnce(downvoted !== null);
  const showFeedbackForm = useOpenedOnce(formRequest !== null);
  const { anyMenuOpen, setMenuOpen } = useOpenMenus();

  useScreenKeysPause(anyMenuOpen || downvoted !== null || formRequest !== null);

  const chooseVote = useCallback(
    ({ target, vote }: { target: ContentVoteTarget; vote: ContentVoteValue }) => {
      const isSameVote = getVote(target) === vote;

      if (vote === "down") {
        setDownvoted(target);
      }

      if (isSameVote) {
        return;
      }

      setVote(target, vote);
      void adapters.vote({ ...target, language, vote });

      adapters.track({
        name: "Content Voted",
        properties: { content_id: target.contentId, content_kind: target.contentKind, vote },
      });
    },
    [adapters, getVote, language, setVote],
  );

  const saveDownvoteDetails = useCallback<ContentFeedbackContextValue["saveDownvoteDetails"]>(
    ({ comment, reasons, target }) => {
      void adapters.vote({ ...target, comment: comment || null, language, reasons, vote: "down" });
    },
    [adapters, language],
  );

  const value = useMemo(
    () => ({
      adapters,
      chooseVote,
      getVote,
      loadVote,
      openFeedbackForm: setFormRequest,
      saveDownvoteDetails,
      setMenuOpen,
    }),
    [adapters, chooseVote, getVote, loadVote, saveDownvoteDetails, setMenuOpen],
  );

  return (
    <ContentFeedbackContext value={value}>
      {children}
      {showDownvoteSheet && (
        <Suspense fallback={null}>
          <DownvoteSheet onClose={() => setDownvoted(null)} target={downvoted} />
        </Suspense>
      )}
      {showFeedbackForm && (
        <Suspense fallback={null}>
          <FeedbackFormDialog onClose={() => setFormRequest(null)} request={formRequest} />
        </Suspense>
      )}
    </ContentFeedbackContext>
  );
}
