"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionResult,
  SuggestionSaveError,
} from "../_components/suggestion";
import { getChangeMark } from "./today-change-mark";
import { useTodayScreen } from "./today-context";
import { TodaySuggestionCard } from "./today-suggestion-card";

type Change = NonNullable<TodayView["planChange"]>;

/** Every name, however many: nothing else says what left the plan. */
function useRemovedLine() {
  const t = useExtracted();
  const format = useFormatter();

  return function removedLine(removed: readonly string[]): string | null {
    if (removed.length === 0) {
      return null;
    }

    return t({
      description:
        'Lists every subject or topic the plan no longer holds, like "Portuguese, Logic and English".',
      message: "Out of your plan: {names}",
      values: { names: format.list(removed, { type: "conjunction" }) },
    });
  };
}

/** Seeing it is the only answer: the plan already changed. */
function useSeen({ change, onHold }: { change: Change; onHold: (held: boolean) => void }) {
  const { actions } = useTodayScreen();
  const [state, setState] = useState<"failed" | "seen" | null>(null);
  const [isPending, startTransition] = useTransition();

  const see = () => {
    onHold(true);

    startTransition(async () => {
      const { data } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status: "seen" }),
      );

      if (!data || data === "stale") {
        setState(data ? null : "failed");
        onHold(false);
        return;
      }

      setState("seen");
    });
  };

  return { isPending, see, state };
}

/** The plan already follows the exam's notice: nothing to decide, only what left it to see. */
export function NoticeFollowedNotice({
  change,
  onHold,
  onNext,
}: {
  change: Change;
  onHold: (held: boolean) => void;
  onNext: (() => void) | null;
}) {
  const t = useExtracted();
  const removedLine = useRemovedLine()(change.effect?.noticeRemoved ?? []);
  const { isPending, see, state } = useSeen({ change, onHold });

  return (
    <Suggestion
      answered={state === "seen"}
      data-slot="today-plan-change"
      label={t("Plan change")}
      mark={getChangeMark(change)}
    >
      <TodaySuggestionCard>
        {state === "seen" ? (
          <>
            <SuggestionResult>{t("Noted.")}</SuggestionResult>
            {onNext && (
              <SuggestionActions>
                <SuggestionAction onClick={onNext} variant="outline">
                  {t("Next suggestion")}
                </SuggestionAction>
              </SuggestionActions>
            )}
          </>
        ) : (
          <>
            <SuggestionHeader>
              {t({
                description:
                  'Says the plan already changed by itself. In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide.',
                message:
                  "{document, select, notice {Your plan now follows the official guide} other {Your plan now follows the official guide}}",
                values: { document: change.examDocument },
              })}
            </SuggestionHeader>
            {removedLine && <SuggestionDescription>{removedLine}</SuggestionDescription>}
            <SuggestionActions
              main={
                <SuggestionAction action={see} busy={isPending} variant="outline">
                  {t("Got it")}
                </SuggestionAction>
              }
            />
          </>
        )}
        {state === "failed" && <SuggestionSaveError />}
      </TodaySuggestionCard>
    </Suggestion>
  );
}
