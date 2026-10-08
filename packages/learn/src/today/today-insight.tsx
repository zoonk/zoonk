"use client";

import { type MemoryInsightView } from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, LightbulbIcon, ListPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { SURFACE_CLASS } from "../_components/surface";
import { useLearnAnalytics } from "../learn-context";
import { useAppliedLine, useProposalEffectText } from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";

type InsightAnswer = "accepted" | "dismissed";
type InsightState = { answer: InsightAnswer } | { failed: true } | null;

const ANALYTICS_KIND = {
  planChange: "plan_change",
  scheduleIdea: "schedule",
  tip: "tip",
} as const satisfies Record<MemoryInsightView["kind"], string>;

function InsightIcon({ kind }: { kind: MemoryInsightView["kind"] }) {
  const className = "size-4.5";

  if (kind === "planChange") {
    return <ListPlusIcon aria-hidden="true" className={className} />;
  }

  if (kind === "scheduleIdea") {
    return <CalendarClockIcon aria-hidden="true" className={className} />;
  }

  return <LightbulbIcon aria-hidden="true" className={className} />;
}

/** The two answers an insight offers, in words that say what each one does. */
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

/**
 * What a bigger plan change does before the learner says yes: "Adds 6 lessons." Its new end is
 * said only as the Plan tab says it: by month, for a plan without a date, from the end the plan
 * shows now. A one-lesson change is already in the plan, with an undo, so it needs no numbers.
 */
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

  return <p className="text-muted-foreground text-sm">{effect}</p>;
}

function InsightBody({ insight }: { insight: MemoryInsightView }) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const { actions } = useTodayScreen();
  const choices = useInsightChoices(insight);
  const answeredText = useAnsweredText(insight);
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

  if (state && "answer" in state) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {answeredText(state.answer)}
      </p>
    );
  }

  return (
    <>
      <p className="text-sm leading-relaxed">{insight.message}</p>
      <InsightPlanEffect planChange={insight.planChange} />

      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} onClick={() => answer("accepted")} size="sm" variant="outline">
          {choices.accept}
        </Button>

        {choices.dismiss && (
          <Button
            disabled={isPending}
            onClick={() => answer("dismissed")}
            size="sm"
            variant="ghost"
          >
            {choices.dismiss}
          </Button>
        )}
      </div>

      {state && "failed" in state && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again.")}
        </p>
      )}
    </>
  );
}

/**
 * Answering an insight refreshes Today, which no longer carries it; the card stays until the
 * learner leaves, so they can see what their answer did.
 */
function useShownInsight(insight: MemoryInsightView | null): MemoryInsightView | null {
  const [shown, setShown] = useState(insight);

  if (insight && insight.id !== shown?.id) {
    setShown(insight);
  }

  return insight ?? shown;
}

/**
 * At most one insight from recent sessions: a tip, a plan change with its reason (one lesson kept
 * or undone here; a bigger gap added only after an OK, with its effect on the end date), or a
 * schedule idea. It leaves Today once answered.
 */
export function TodayInsight() {
  const t = useExtracted();
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

  return (
    <aside
      aria-label={t("From your recent answers")}
      className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4")}
    >
      <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <InsightIcon kind={insight.kind} />
        {t("From your recent answers")}
      </p>

      <InsightBody insight={insight} />
    </aside>
  );
}
