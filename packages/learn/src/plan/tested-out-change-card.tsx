"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionHeader,
  SuggestionResult,
  SuggestionSaveError,
} from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { type GoalDateKind } from "./goal-date-kind";
import { usePlanScreen } from "./plan-context";
import { usePlanDateKind } from "./use-change-sentence";
import { useSkippedLessonsSentences } from "./use-skipped-lessons-sentences";
import { useSystemChangeSentence } from "./use-system-change-sentence";

export function TestedOutChangeCard({
  change,
  dateKind,
  onUndo,
}: {
  change: PlanChangeView;
  dateKind: GoalDateKind;
  onUndo: (changeId: string) => Promise<boolean>;
}) {
  const t = useExtracted();
  const title = useSystemChangeSentence()(change) ?? t("Plan updated");
  const sentences = useSkippedLessonsSentences();
  const [undone, setUndone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const restored = undone || change.status === "undone";

  const undo = () =>
    startTransition(async () => {
      const saved = await onUndo(change.id).catch(() => false);
      setFailed(!saved);
      setUndone(saved);
    });

  return (
    <Suggestion answered={restored ? "undone" : false} data-slot="tested-out-change" label={title}>
      <SuggestionContent everyWidth>
        {restored ? (
          <SuggestionResult>{sentences.back(change.lessonsSkipped)}</SuggestionResult>
        ) : (
          <>
            <SuggestionHeader>{title}</SuggestionHeader>
            <PlanEffectDiff dateKind={dateKind} effect={change.effect} summary={false} />
            {change.canUndo && (
              <SuggestionActions>
                <SuggestionAction
                  onClick={undo}
                  busy={pending}
                  icon={<Undo2Icon aria-hidden="true" />}
                  variant="outline"
                >
                  {t("Undo")}
                </SuggestionAction>
              </SuggestionActions>
            )}
          </>
        )}
        {failed && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}

export function PlanTestedOutChange() {
  const { actions, plan } = usePlanScreen();
  const dateKind = usePlanDateKind();
  const change = plan.changes.find((candidate) => candidate.kind === "testedOut");

  if (!change || (!change.canUndo && change.status !== "undone")) {
    return null;
  }

  return (
    <TestedOutChangeCard
      change={change}
      dateKind={dateKind}
      key={change.id}
      onUndo={(changeId) => actions.decide({ changeId, status: "undone" })}
    />
  );
}
