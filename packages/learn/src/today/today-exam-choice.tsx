"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useLearnAnalytics } from "../learn-context";
import { ExamChoiceQuestion } from "../plan/plan-exam-choices";
import { PlanFailedMessage } from "../plan/plan-failed-message";
import { useChangeSentence } from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";
import { ProposalEffect } from "./today-plan-change";

/** Runs one of the notice's saves with a pending state and a failure flag. */
function useSave() {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function save<T>(action: () => Promise<T | null>, onSaved: (result: T) => void) {
    setFailed(false);

    startTransition(async () => {
      const { data } = await safeAsync(action);

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        setFailed(!data);

        if (data) {
          onSaved(data);
        }
      });
    });
  }

  return { failed, isPending, save };
}

/** What the pick did, where its question was, with Undo, which asks again. */
function ChoicePicked({ change, onUndone }: { change: PlanChangeView; onUndone: () => void }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { actions } = useTodayScreen();
  const { failed, isPending, save } = useSave();

  const undo = () =>
    save(() => actions.decidePlanChange({ changeId: change.id, status: "undone" }), onUndone);

  return (
    <NoticeCard>
      <NoticeCardLeading>
        <KindTile icon={SignpostIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent role="status">
        <NoticeCardTitle>{sentence(change)}</NoticeCardTitle>
        <ProposalEffect change={change} />
        {change.canUndo && (
          <NoticeCardActions>
            <Button
              disabled={isPending}
              focusableWhenDisabled
              onClick={undo}
              size="sm"
              variant="outline"
            >
              {t("Undo")}
            </Button>
          </NoticeCardActions>
        )}
        {failed && <PlanFailedMessage />}
      </NoticeCardContent>
    </NoticeCard>
  );
}

/**
 * An exam choice the learner left for later ("Decide later" in onboarding), asked on Today, where
 * they study: until they pick, the plan studies none of its options (Ana, 15 days in, had no
 * foreign language, and only the plan's pages said so). The pick then says what it did in place.
 */
export function TodayExamChoice() {
  const { actions, today } = useTodayScreen();
  const analytics = useLearnAnalytics();
  const [picked, setPicked] = useState<PlanChangeView | null>(null);
  const { failed, isPending, save } = useSave();

  if (picked) {
    return <ChoicePicked change={picked} onUndone={() => setPicked(null)} />;
  }

  if (!today.examChoice) {
    return null;
  }

  const pick = (input: { group: string; subject: string }) =>
    save(
      () => actions.chooseExamOption(input),
      (change) => {
        setPicked(change);
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setExamChoice" } });
      },
    );

  return (
    <ExamChoiceQuestion
      choice={today.examChoice}
      failed={failed}
      isPending={isPending}
      onPick={pick}
    />
  );
}
