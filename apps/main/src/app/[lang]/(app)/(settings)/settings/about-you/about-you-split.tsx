"use client";

import { type ProfileQuestionsView } from "@zoonk/core/profile/questions/contract";
import { AboutYouScreen } from "@zoonk/learn/about-you";
import { isFocusLost } from "@zoonk/learn/focus-lost";
import { useSideColumn } from "@zoonk/learn/side-detail";
import { cn } from "@zoonk/ui/lib/utils";
import { useSelectedLayoutSegment } from "next/navigation";
import { createContext, use, useCallback, useLayoutEffect, useRef } from "react";

/** Tells the tab which question its detail shows now, and hears back whether it replaced another. */
const ShowQuestionContext = createContext<(question: string | null) => boolean>(() => false);

/**
 * Save leaves with the question it saved, so the one that takes its place beside the list takes
 * focus on its title. A question nobody can see is the list alone: nothing has taken a place.
 */
export function useFocusQuestionThatReplaced(question: string) {
  const show = use(ShowQuestionContext);

  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>(
      '[data-slot="settings-detail"] [data-slot="page-title"]',
    );

    const replaced = show(title?.checkVisibility() ? question : null);

    if (replaced && isFocusLost(document.activeElement)) {
      title?.focus({ preventScroll: true });
    }
  }, [question, show]);
}

/**
 * From `xl`, for whoever has a session, the questions are a list at the start and the open one
 * keeps the column's measure on the end edge, its Save in the page's bar: the notebook's list and
 * detail. Anywhere else the list is the page and a picked question takes its place.
 */
const SPLIT_CLASS =
  "contents xl:in-data-signed-in:grid xl:in-data-signed-in:flex-1 xl:in-data-signed-in:grid-cols-[minmax(20rem,1fr)_minmax(0,calc(var(--container-column)+var(--page-gutter)+1px))] xl:in-data-signed-in:gap-x-8";

const LIST_WHILE_PICKED_CLASS = "hidden xl:in-data-signed-in:contents";

const DETAIL_CLASS =
  "xl:in-data-signed-in:border-border xl:in-data-signed-in:flex xl:in-data-signed-in:min-w-0 xl:in-data-signed-in:flex-col xl:in-data-signed-in:border-s xl:in-data-signed-in:ps-(--page-gutter)";

export function AboutYouSplit({
  children,
  list,
}: {
  /** A picked question, or the one a wide screen opens before a pick. */
  children: React.ReactNode;
  list: React.ReactNode;
}) {
  const picked = useSelectedLayoutSegment() !== null;
  const shown = useRef<string | null>(null);

  const show = useCallback((question: string | null) => {
    const replaced = shown.current !== null && question !== null && shown.current !== question;
    shown.current = question;
    return replaced;
  }, []);

  return (
    <ShowQuestionContext value={show}>
      <div className={SPLIT_CLASS}>
        <div className={picked ? LIST_WHILE_PICKED_CLASS : "contents"}>{list}</div>

        <div
          className={cn(picked ? "contents" : "hidden", DETAIL_CLASS)}
          data-slot="settings-detail"
        >
          {children}
        </div>
      </div>
    </ShowQuestionContext>
  );
}

/** The list, with the question open beside it marked as the current one. */
export function AboutYouCurrentScreen({
  fallback,
  view,
}: {
  /** The question a wide screen opens before a pick. */
  fallback: string | null;
  view: ProfileQuestionsView;
}) {
  const picked = useSelectedLayoutSegment();
  const beside = useSideColumn();

  return <AboutYouScreen current={picked ?? (beside ? fallback : null)} view={view} />;
}
