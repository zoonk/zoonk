"use client";

import { type FocusTestView } from "@zoonk/core/learner/placement/focus-test-contract";
import { Button } from "@zoonk/ui/components/button";
import { Switch } from "@zoonk/ui/components/switch";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "../_components/list-group";
import { ChangeSaveError } from "../_components/save-error";
import { SettingRow } from "../_components/setting-rows";
import { OnboardingDescription, OnboardingSecondaryButton } from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import {
  type FocusTestPlanActions,
  FocusTestProposal,
  type ProposalAnswer,
  useProposalAnswer,
} from "./focus-test-proposal";
import { FocusSubjects, FocusTestSubjectsSheet } from "./focus-test-subjects";
import { type Pressed } from "./use-focus-test";
import { useResultWords } from "./use-result-line";

export type FocusTestHost = "onboarding" | "plan";

function ResultRows({
  changesFocus,
  focusTest,
  plan,
}: {
  changesFocus: boolean;
  focusTest: FocusTestView;
  plan: FocusTestPlanActions;
}) {
  const t = useExtracted();
  const labelId = useId();
  const noteId = useId();
  const [sessionQuestions, setSessionQuestions] = useState(focusTest.sessionQuestions);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setAsking = (asking: boolean) => {
    const before = sessionQuestions;
    const next = asking ? "on" : "paused";
    setSessionQuestions(next);

    startTransition(async () => {
      const saved = await plan.setSessionQuestions(next).catch(() => null);
      setFailed(!saved);
      setSessionQuestions(saved?.sessionQuestions ?? before);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ListGroup>
        {changesFocus && (
          <ListRowLink href={plan.changeFocusHref}>
            <ListRowContent>
              <ListRowTitle className="font-normal">{t("Change focus")}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        )}

        <FocusTestSubjectsSheet subjects={focusTest.subjects} />

        {sessionQuestions !== "off" && (
          <SettingRow
            description={t("During your first week")}
            descriptionId={noteId}
            label={
              <span className="font-normal" id={labelId}>
                {t({
                  description:
                    "Label of an on/off switch on the Focus test's result. “A few more” means test questions, asked while the learner studies their lessons.",
                  message: "Ask a few more as I study",
                })}
              </span>
            }
          >
            <Switch
              aria-busy={isPending || undefined}
              aria-describedby={noteId}
              aria-labelledby={labelId}
              checked={sessionQuestions !== "paused"}
              onCheckedChange={setAsking}
              readOnly={isPending}
            />
          </SettingRow>
        )}
      </ListGroup>

      {failed && <ChangeSaveError />}
    </div>
  );
}

function FocusTestResult({
  answer,
  failed,
  focusTest,
  host,
  onContinueTest,
  onDone,
  onUndo,
  plan,
  pressed,
  undoing,
}: {
  /** The learner's answer to the test's proposal on this visit, which the line then says. */
  answer: ProposalAnswer | null;
  failed: boolean;
  focusTest: FocusTestView;
  host: FocusTestHost;
  onContinueTest: () => void;
  onDone: () => void;
  onUndo: () => void;
  plan: FocusTestPlanActions | null;
  pressed: Pressed;
  undoing: boolean;
}) {
  const t = useExtracted();
  const words = useResultWords();
  const focus = focusTest.checkpoint?.focus ?? null;
  const lessonsSkipped = focusTest.checkpoint?.lessonsSkipped ?? 0;
  // A goal still being set up has no plan page to choose a focus on.
  const changesFocus = focus !== null && focus.state !== "ifTimeShort";
  const line = focus && words.line(focus.state);

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={host === "onboarding" ? undefined : t("Done")}
      disabled={pressed === "other"}
      failed={failed}
      lead={
        answer ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
            <OnboardingDescription role="status">
              {words.answered(answer.decision)}
            </OnboardingDescription>

            {answer.decision === "applied" && answer.change.canUndo && (
              <Button
                busy={undoing}
                icon={<Undo2Icon aria-hidden="true" />}
                onClick={onUndo}
                size="sm"
                variant="outline"
              >
                {t("Undo")}
              </Button>
            )}
          </div>
        ) : (
          line && <OnboardingDescription>{line}</OnboardingDescription>
        )
      }
      onContinue={onDone}
      other={
        host === "plan" &&
        focusTest.offer && (
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pressed === "main"}
            onClick={onContinueTest}
          >
            {t({
              description:
                "Button on the Focus test's result: continues the test with more questions.",
              message: "Answer more questions",
            })}
          </OnboardingSecondaryButton>
        )
      }
      subject={t("Focus test")}
      title={words.title({ focus, lessonsSkipped })}
    >
      {focus && <FocusSubjects rows={focus.rows} />}

      {focus && lessonsSkipped > 0 && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t(
            "{count, plural, one {Your plan also skips # lesson you already know.} other {Your plan also skips # lessons you already know.}}",
            { count: lessonsSkipped },
          )}
        </p>
      )}

      {plan && <ResultRows changesFocus={changesFocus} focusTest={focusTest} plan={plan} />}
    </TestOutcome>
  );
}

/**
 * The test's result. A proposal the learner can still apply asks its question first, on its own
 * screen, and the result that follows says what the answer did.
 */
export function FocusTestCheckpoint({
  failed,
  focusTest,
  host,
  onContinueTest,
  onDone,
  plan,
  pressed,
}: {
  failed: boolean;
  focusTest: FocusTestView;
  host: FocusTestHost;
  onContinueTest: () => void;
  onDone: () => void;
  plan: FocusTestPlanActions | null;
  pressed: Pressed;
}) {
  const { answer, decide, failed: answerFailed, pressed: decision } = useProposalAnswer(plan);
  const focus = focusTest.checkpoint?.focus ?? null;
  const proposal = plan && focus?.proposal?.canApply ? focus.proposal : null;

  if (focus && proposal && !answer) {
    return (
      <FocusTestProposal
        failed={answerFailed}
        onDecide={(status) => decide(proposal.id, status)}
        pressed={decision}
        proposal={proposal}
        rows={focus.rows}
      />
    );
  }

  const undo = () => {
    if (answer) {
      decide(answer.change.id, "undone");
    }
  };

  return (
    <FocusTestResult
      answer={answer}
      failed={failed || answerFailed}
      focusTest={focusTest}
      host={host}
      onContinueTest={onContinueTest}
      onDone={onDone}
      onUndo={undo}
      plan={plan}
      pressed={pressed}
      undoing={decision === "undone"}
    />
  );
}
