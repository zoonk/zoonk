"use client";

import { INSIGHT_EVENT_KINDS } from "@zoonk/core/analytics/events";
import { type MemoryInsightView } from "@zoonk/core/memory/contract";
import { safeAsync } from "@zoonk/utils/error";
import { LightbulbIcon, ListPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLearnAnalytics } from "../learn-context";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useAppliedLine } from "../plan/use-change-sentence";
import { useTodayDateKind } from "./today-change-sentence";
import { useTodayScreen } from "./today-context";

type InsightAnswer = "accepted" | "dismissed";

type InsightState =
  | { answer: InsightAnswer }
  | { failed: true }
  | { repriced: MemoryInsightView }
  | null;

function insightMark(insight: MemoryInsightView): React.ReactNode {
  if (insight.kind === "tip") {
    return <LightbulbIcon />;
  }

  return insight.planChange?.status === "applied" ? <ListPlusIcon /> : undefined;
}

function useInsightChoices(insight: MemoryInsightView) {
  const t = useExtracted();

  if (insight.kind === "planChange") {
    return insight.planChange?.status === "proposed"
      ? { accept: t("Add it"), dismiss: t("No thanks") }
      : { accept: t("Keep it"), dismiss: t("Undo") };
  }

  if (insight.kind === "scheduleIdea") {
    return { accept: t("Move it"), dismiss: t("Not now") };
  }

  return { accept: t("Got it"), dismiss: null };
}

function useAnsweredText(insight: MemoryInsightView) {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  return (answer: InsightAnswer): string => {
    if (insight.kind === "planChange") {
      return answer === "accepted" ? appliedLine(null) : t("Your plan stays as it was.");
    }

    if (insight.kind === "scheduleIdea") {
      return answer === "accepted"
        ? t({
            description: "The time of day the learner studies changed.",
            message: "Study time moved.",
          })
        : t({
            description: "The time of day the learner studies stays the same.",
            message: "Your study time stays the same.",
          });
    }

    return t("Noted.");
  };
}

function useInsightAnswer(insight: MemoryInsightView) {
  const { actions } = useTodayScreen();
  const [state, setState] = useState<InsightState>(null);
  const [isPending, startTransition] = useTransition();

  const shown = state !== null && "repriced" in state ? state.repriced : insight;

  const answer = (status: InsightAnswer) => {
    startTransition(async () => {
      const { data: saved } = await safeAsync(() =>
        actions.answerInsight({
          insightId: shown.id,
          quote: shown.planChange?.quote ?? null,
          status,
        }),
      );

      if (!saved) {
        setState({ failed: true });
        return;
      }

      // Accepted, and still waiting: its plan change's numbers moved, so it asks again.
      setState(
        status === "accepted" && saved.status === "pending"
          ? { repriced: saved }
          : { answer: status },
      );
    });
  };

  return { answer, isPending, state };
}

function InsightActions({
  insight,
  isPending,
  onAnswer,
}: {
  insight: MemoryInsightView;
  isPending: boolean;
  onAnswer: (status: InsightAnswer) => void;
}) {
  const choices = useInsightChoices(insight);

  return (
    <SuggestionActions>
      {/* A tip's only answer is outline, so Today's own action stays the screen's one filled
          button. */}
      {(insight.kind !== "planChange" ||
        insight.planChange?.status === "applied" ||
        insight.planChange?.canApply) && (
        <SuggestionAction
          action={() => onAnswer("accepted")}
          disabled={isPending}
          variant={choices.dismiss ? "default" : "outline"}
        >
          {choices.accept}
        </SuggestionAction>
      )}

      {choices.dismiss && (
        <SuggestionAction
          action={() => onAnswer("dismissed")}
          disabled={isPending}
          variant="outline"
        >
          {choices.dismiss}
        </SuggestionAction>
      )}
    </SuggestionActions>
  );
}

function InsightNotice({ insight: opened }: { insight: MemoryInsightView }) {
  const t = useExtracted();
  const dateKind = useTodayDateKind();
  const { answer, isPending, state } = useInsightAnswer(opened);
  const repriced = state !== null && "repriced" in state;
  const insight = repriced ? state.repriced : opened;
  const answeredText = useAnsweredText(insight);
  const result = state && "answer" in state ? answeredText(state.answer) : null;

  return (
    <Suggestion
      answered={result !== null}
      label={t("From your recent answers")}
      mark={insightMark(insight)}
    >
      <SuggestionLine>
        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionSummary>{insight.message}</SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{t("From your recent answers")}</SuggestionHeader>
        <SuggestionDescription className="text-foreground">{insight.message}</SuggestionDescription>
        {insight.planChange?.status === "proposed" && (
          <PlanEffectDiff
            dateKind={dateKind}
            effect={insight.planChange.effect}
            repriced={repriced}
          />
        )}

        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <InsightActions insight={insight} isPending={isPending} onAnswer={answer} />
        )}

        {state && "failed" in state && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}

/**
 * Answering refreshes Today, which no longer carries the insight; the card stays until the learner
 * leaves, to show what the answer did.
 */
function useShownInsight(insight: MemoryInsightView | null): MemoryInsightView | null {
  const [shown, setShown] = useState(insight);

  if (insight && insight.id !== shown?.id) {
    setShown(insight);
  }

  return insight ?? shown;
}

export function TodayInsight() {
  const analytics = useLearnAnalytics();
  const { today } = useTodayScreen();
  const insight = useShownInsight(today.insight);

  useEffect(() => {
    if (insight) {
      analytics.track({
        name: "Insight Shown",
        properties: { insight: INSIGHT_EVENT_KINDS[insight.kind] },
      });
    }
  }, [analytics, insight]);

  if (!insight) {
    return null;
  }

  return <InsightNotice insight={insight} key={insight.id} />;
}
