"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
  useMainActionVariant,
} from "../_components/suggestion";
import { SuggestionMenu } from "../_components/suggestion-menu";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useTodayScreen } from "./today-context";
import { isWelcomeBackDay } from "./use-today-copy";

type Change = NonNullable<TodayView["planChange"]>;
type Behind = NonNullable<PlanChangeView["behind"]>;
type Answer = { kept: true } | { failed: true } | null;
type Option = "adjustTime" | "focus" | "studyEverything";

function useBehindSentence() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatDuration = useFormatDuration();

  return (behind: Behind): string => {
    const values = {
      after: formatShare(behind.coveredAfter),
      before: formatShare(behind.coveredBefore),
      time: formatDuration(behind.currentMinutes),
    };

    return behind.measure === "exam"
      ? t("{time} a day now covers {after} of the exam, down from {before}.", values)
      : t("{time} a day now covers {after} of your goal, down from {before}.", values);
  };
}

/** On a return after a break, nothing that asks for more hours leads. */
function getLeadingOption({
  behind,
  returnDay,
}: {
  behind: Behind;
  returnDay: boolean;
}): Option | null {
  if (!returnDay) {
    return "adjustTime";
  }

  return behind.canFocus ? "focus" : null;
}

function useOptions(behind: Behind): { href: string; label: string; option: Option }[] {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const isExam = today.goal.kind === "exam";

  return [
    {
      href: actions.adjustTimeHref,
      label: isExam ? t("Add time") : t("Adjust plan"),
      option: "adjustTime" as const,
    },
    behind.canFocus && {
      href: actions.chooseFocusHref,
      label: t("Choose where to focus"),
      option: "focus" as const,
    },
    {
      href: actions.studyEverythingHref,
      label: isExam ? t("Keep studying after the exam") : t("Study everything"),
      option: "studyEverything" as const,
    },
  ].filter((option) => option !== false);
}

function BehindChoices({
  behind,
  isPending,
  keep,
  superseded,
}: {
  behind: Behind;
  isPending: boolean;
  keep: () => void;
  superseded: boolean;
}) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const options = useOptions(behind);
  const leading = getLeadingOption({ behind, returnDay: isWelcomeBackDay(today.session) });
  const lead = options.find(({ option }) => option === leading);
  const others = options.filter(({ option }) => option !== leading);
  const mainVariant = useMainActionVariant();

  return (
    <SuggestionActions
      main={
        lead && (
          <SuggestionLinkAction href={lead.href} variant={mainVariant}>
            {lead.label}
          </SuggestionLinkAction>
        )
      }
      menu={
        <SuggestionMenu>
          {others.map(({ href, label, option }) => (
            <DropdownMenuItem key={option} render={<LearnLink href={href} />}>
              {label}
            </DropdownMenuItem>
          ))}
        </SuggestionMenu>
      }
    >
      <SuggestionAction
        action={keep}
        busy={isPending}
        disabled={superseded}
        key="keep"
        variant="outline"
      >
        {t({ description: "Keeps the learner's time a day as it is.", message: "Keep my time" })}
      </SuggestionAction>
    </SuggestionActions>
  );
}

/** Keeping their time changes nothing: the learner's "seen" is their answer. */
function useKeepTime({
  change,
  onAnswer,
  onHold,
}: {
  change: Change;
  onAnswer: (answer: Answer) => void;
  onHold: (held: boolean) => void;
}) {
  const { actions } = useTodayScreen();
  const [superseded, setSuperseded] = useState<Change | null>(null);
  const [isPending, startTransition] = useTransition();

  const keep = () => {
    onHold(true);

    startTransition(async () => {
      const { data } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status: "seen", surface: "behind" }),
      );

      if (!data || data === "stale") {
        onAnswer(data === "stale" ? null : { failed: true });
        setSuperseded(data === "stale" ? change : null);
        onHold(false);
        return;
      }

      onAnswer({ kept: true });
    });
  };

  return { isPending, keep, superseded: superseded === change };
}

export function FallingBehindNotice({
  behind,
  change,
  onHold,
}: {
  behind: Behind;
  change: Change;
  onHold: (held: boolean) => void;
}) {
  const t = useExtracted();
  const sentence = useBehindSentence();
  const [answer, setAnswer] = useState<Answer>(null);
  const { isPending, keep, superseded } = useKeepTime({ change, onAnswer: setAnswer, onHold });
  const answered = answer !== null && !("failed" in answer);

  const title = t("You missed a few days");
  const result = t("Okay. Your time stays the same.");

  return (
    <Suggestion
      answered={answered}
      data-slot="today-plan-change"
      label={t("Plan change")}
      mark={<CalendarClockIcon />}
    >
      <SuggestionLine>
        {answered ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionSummary>{title}</SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>{sentence(behind)}</SuggestionDescription>
        <PlanEffectDiff effect={change.effect} summary={false} />

        {answered ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <BehindChoices
            behind={behind}
            isPending={isPending}
            keep={keep}
            superseded={superseded}
          />
        )}

        {answer && "failed" in answer && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}
