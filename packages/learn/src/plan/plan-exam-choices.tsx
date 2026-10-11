"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { safeAsync } from "@zoonk/utils/error";
import { SignpostIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useLearnAnalytics } from "../learn-context";
import { PlanChangeSummary } from "./plan-change-applied";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useUndoChange } from "./use-undo-change";

/** Options share the row but never squeeze a label onto two lines; they wrap instead. */
const OPTION_CLASS =
  "border-border has-data-checked:border-foreground flex min-h-11 min-w-max flex-1 cursor-pointer items-center gap-2 rounded-2xl border px-3 text-sm";

/**
 * Saves a pick with a pending state and a failure flag, like the plan's other controls. The change
 * it made becomes the editor's latest, so the editor says which option the plan now studies, with
 * Undo (see `PlanEditorChange`); `onChange` hears it too, for a card that says it in place.
 */
function useExamChoice({ onChange }: { onChange?: (change: PlanChangeView) => void } = {}) {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (input: { group: string; subject: string }) => {
    setFailed(false);
    keepFocus();

    startTransition(async () => {
      const { data: outcome } = await safeAsync(() => actions.chooseExamOption(input));

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        setFailed(!outcome);

        if (outcome?.change) {
          editor.report(outcome.change);
          onChange?.(outcome.change);
        }
      });

      if (outcome) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setExamChoice" } });
      }
    });
  };

  return { choose, failed, isPending };
}

/** One of the exam's choices: its options, one tap each, and what an unpicked choice means. */
function ExamChoice({ choice }: { choice: ExamChoiceView }) {
  const t = useExtracted();
  const { choose, failed, isPending } = useExamChoice();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{choice.group}</legend>

      <RadioGroup
        className="flex flex-wrap gap-2"
        disabled={isPending}
        onValueChange={(value) => {
          if (typeof value === "string" && value !== choice.subject) {
            choose({ group: choice.group, subject: value });
          }
        }}
        value={choice.subject ?? ""}
      >
        {choice.options.map((option) => (
          <RadioGroupOption className={OPTION_CLASS} key={option.name}>
            <RadioGroupItem value={option.name} />
            {option.shortName ?? option.name}
          </RadioGroupOption>
        ))}
      </RadioGroup>

      {!choice.subject && (
        <p className="text-muted-foreground text-sm">
          {t("Pick the one you'll take. Until you do, your plan leaves {group} out.", {
            group: choice.group,
          })}
        </p>
      )}

      {failed && <PlanFailedMessage />}
    </fieldset>
  );
}

/**
 * The exam's choices in "Adjust your plan" (ENEM's foreign language: English or Spanish): the
 * plan, practice and mocks study only the option picked, and changing it re-plans from today.
 */
export function PlanExamChoices() {
  const { plan } = usePlanScreen();

  return plan.examChoices.map((choice) => <ExamChoice choice={choice} key={choice.group} />);
}

/**
 * One of the exam's choices the learner hasn't picked yet, as a question: one tap per option. The
 * Journey and Today ask it the same way, each saving the pick with its own actions (`onPick`).
 */
export function ExamChoiceQuestion({
  choice,
  failed,
  isPending,
  onPick,
}: {
  choice: ExamChoiceView;
  failed: boolean;
  isPending: boolean;
  onPick: (input: { group: string; subject: string }) => void;
}) {
  const t = useExtracted();

  return (
    <NoticeCard data-slot="exam-choice-notice">
      <NoticeCardLeading>
        <KindTile icon={SignpostIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>
          {t("{group}: which one will you take?", { group: choice.group })}
        </NoticeCardTitle>
        <NoticeCardDescription>
          {t("Until you pick, your plan leaves {group} out.", { group: choice.group })}
        </NoticeCardDescription>
        <NoticeCardActions>
          {choice.options.map((option) => (
            <Button
              disabled={isPending}
              focusableWhenDisabled
              key={option.name}
              onClick={() => onPick({ group: choice.group, subject: option.name })}
              size="sm"
              variant="secondary"
            >
              {option.shortName ?? option.name}
            </Button>
          ))}
        </NoticeCardActions>
        {failed && <PlanFailedMessage />}
      </NoticeCardContent>
    </NoticeCard>
  );
}

/** The question on the Journey: the pick is the plan editor's latest change too. */
function ChoiceQuestion({
  choice,
  onPicked,
}: {
  choice: ExamChoiceView;
  onPicked: (change: PlanChangeView) => void;
}) {
  const { choose, failed, isPending } = useExamChoice({ onChange: onPicked });

  return (
    <ExamChoiceQuestion choice={choice} failed={failed} isPending={isPending} onPick={choose} />
  );
}

/** What a pick did, where its question was, with Undo while it's the plan's latest change. */
function ChoicePicked({ change, onUndone }: { change: PlanChangeView; onUndone: () => void }) {
  const t = useExtracted();
  const { failed, isPending, undo } = useUndoChange({ change, onUndone });

  return (
    <NoticeCard className="flex-col">
      <PlanChangeSummary change={change} icon={SignpostIcon} />
      {change.canUndo && (
        <Button
          className="self-start"
          disabled={isPending}
          focusableWhenDisabled
          onClick={undo}
          size="sm"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      )}
      {failed && <PlanFailedMessage />}
    </NoticeCard>
  );
}

/**
 * The exam's choices the learner hasn't picked yet, asked on the plan's page until they do, since
 * the plan studies none of a choice's options before (Ana, 15 days in, had no foreign language,
 * and only the editor said so). The pick then says what it did in the question's place.
 */
export function ExamChoiceNotices() {
  const { plan } = usePlanScreen();
  const [picked, setPicked] = useState<PlanChangeView | null>(null);

  if (picked) {
    return <ChoicePicked change={picked} onUndone={() => setPicked(null)} />;
  }

  return plan.examChoices
    .filter((choice) => !choice.subject)
    .map((choice) => <ChoiceQuestion choice={choice} key={choice.group} onPicked={setPicked} />);
}
