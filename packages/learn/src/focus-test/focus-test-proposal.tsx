"use client";

import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestSummary,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { type PlanChangeAnswer } from "@zoonk/core/plans/decision-contract";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { FocusSubjects } from "./focus-test-subjects";

export type Proposal = NonNullable<FocusTestFocus["proposal"]>;
export type Decision = "applied" | "declined" | "undone";
export type ProposalAnswer = { change: Proposal; decision: Decision };

/** What the test's own page can change on the plan; a goal still being set up has none. */
export type FocusTestPlanActions = {
  changeFocusHref: string;
  /** The change as it stands after the answer; null when it wasn't saved. */
  decide: (answer: PlanChangeAnswer) => Promise<Proposal | null>;
  /** The test as it stands after the switch; null when it wasn't saved. */
  setSessionQuestions: (sessionQuestions: "on" | "paused") => Promise<FocusTestSummary | null>;
};

export function useProposalAnswer(plan: FocusTestPlanActions | null) {
  const [answer, setAnswer] = useState<ProposalAnswer | null>(null);
  const [repriced, setRepriced] = useState<Proposal | null>(null);
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<Decision | null>(null);
  const [isPending, startTransition] = useTransition();

  const decide = (change: Proposal, status: Decision) => {
    setPressed(status);

    startTransition(async () => {
      const answered =
        (await plan
          ?.decide({ changeId: change.id, quote: change.quote, status })
          .catch(() => null)) ?? null;

      setFailed(!answered);

      // Accepted, and still waiting: its numbers moved, so it asks again with today's.
      if (answered && status === "applied" && answered.status === "proposed") {
        setRepriced(answered);
      } else if (answered) {
        setAnswer({ change: answered, decision: status });
      }
    });
  };

  return { answer, decide, failed, pressed: isPending ? pressed : null, repriced };
}

export function FocusTestProposal({
  failed,
  onDecide,
  pressed,
  proposal,
  repriced,
  rows,
}: {
  failed: boolean;
  onDecide: (status: Decision) => void;
  pressed: Decision | null;
  proposal: Proposal;
  repriced: boolean;
  rows: readonly FocusRow[];
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          <OnboardingSecondaryButton
            busy={pressed === "declined"}
            disabled={pressed === "applied"}
            onClick={() => onDecide("declined")}
          >
            {t("Not now")}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            busy={pressed === "applied"}
            disabled={pressed === "declined"}
            onClick={() => onDecide("applied")}
          >
            {t("Change my plan")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingSubject>{t("Focus test")}</OnboardingSubject>
        <OnboardingTitle>
          {t({
            description:
              "Headline, above a short list of exam subjects: asks the learner whether their study plan should give those subjects more time.",
            message: "Give these subjects more time?",
          })}
        </OnboardingTitle>
        <OnboardingDescription>
          {t({
            description:
              "Why the Focus test asks to give some subjects more time. “Your time” is the study time the learner has before the exam.",
            message: "Your time can't cover everything before your exam.",
          })}
        </OnboardingDescription>
      </OnboardingHeading>

      <FocusSubjects rows={rows} />
      <PlanEffectDiff dateKind="exam" effect={proposal.effect} repriced={repriced} />
    </OnboardingColumn>
  );
}
