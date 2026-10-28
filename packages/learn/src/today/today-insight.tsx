"use client";

import { type MemoryInsightView } from "@zoonk/core/memory/contract";
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
import { useAppliedLine } from "../plan/use-change-sentence";
import { useProposalEffectText } from "../plan/use-effect-text";
import { useTodayScreen } from "./today-context";

type InsightAnswer = "accepted" | "dismissed";
type InsightState = { answer: InsightAnswer } | { failed: true } | null;

const ANALYTICS_KIND = {
  planChange: "plan_change",
  scheduleIdea: "schedule",
  tip: "tip",
} as const satisfies Record<MemoryInsightView["kind"], string>;

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
    return {
      accept: t("Move my study time to {time}", { time: insight.studyTime ?? "" }),
      dismiss: t("Not now"),
    };
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
      return answer === "accepted" ? t("Study time moved.") : t("Your study time stays the same.");
    }

    return t("Noted.");
  };
}

function InsightPlanEffect({ planChange }: { planChange: MemoryInsightView["planChange"] }) {
  const proposalEffectText = useProposalEffectText();
  const { planEnd, today } = useTodayScreen();
  const targetDate = today.goal.targetDate?.toISOString().slice(0, "YYYY-MM-DD".length) ?? null;

  const effect =
    planChange?.status === "proposed"
      ? proposalEffectText(planChange, { endDate: planEnd, targetDate })
      : null;

  if (!effect) {
    return null;
  }

  return <SuggestionDescription>{effect}</SuggestionDescription>;
}

function useInsightAnswer(insight: MemoryInsightView) {
  const analytics = useLearnAnalytics();
  const { actions } = useTodayScreen();
  const [state, setState] = useState<InsightState>(null);
  const [isPending, startTransition] = useTransition();

  const answer = (status: InsightAnswer) => {
    startTransition(async () => {
      const saved = await actions.answerInsight({ insightId: insight.id, status });
      setState(saved ? { answer: status } : { failed: true });

      if (saved && status === "dismissed" && insight.planChange?.status === "applied") {
        analytics.track({
          name: "Insight Undone",
          properties: { insight: ANALYTICS_KIND[insight.kind] },
        });
      }
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
          disabled={isPending}
          onClick={() => onAnswer("accepted")}
          variant={choices.dismiss ? "default" : "outline"}
        >
          {choices.accept}
        </SuggestionAction>
      )}

      {choices.dismiss && (
        <SuggestionAction
          disabled={isPending}
          onClick={() => onAnswer("dismissed")}
          variant="outline"
        >
          {choices.dismiss}
        </SuggestionAction>
      )}
    </SuggestionActions>
  );
}

function InsightNotice({ insight }: { insight: MemoryInsightView }) {
  const t = useExtracted();
  const answeredText = useAnsweredText(insight);
  const { answer, isPending, state } = useInsightAnswer(insight);
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
        <InsightPlanEffect planChange={insight.planChange} />

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
        properties: { insight: ANALYTICS_KIND[insight.kind] },
      });
    }
  }, [analytics, insight]);

  if (!insight) {
    return null;
  }

  return <InsightNotice insight={insight} key={insight.id} />;
}
