"use client";

import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionTitle } from "../_components/page";
import { ChangeSaveError } from "../_components/save-error";
import { useSentenceSpace } from "../_utils/locale";
import { LearnLink } from "../learn-link";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useProposalEffectText } from "../plan/use-effect-text";
import { type SittingEnd } from "./focus-test-phase";
import { FocusTestSubjectsSheet } from "./focus-test-subjects";
import { getSubjectName, useFocusReasonText } from "./use-focus-test-texts";

type Proposal = NonNullable<FocusTestFocus["proposal"]>;
type Decision = "applied" | "declined" | "undone";

export type FocusTestPlanActions = {
  changeFocusHref: string;
  /** False when it wasn't saved. */
  decide: (input: { changeId: string; status: Decision }) => Promise<boolean>;
};

const SECTION_TEXT_CLASS = "text-sm text-pretty";
const SECTION_NOTE_CLASS = "text-muted-foreground text-sm text-pretty";

function useEvidenceText() {
  const t = useExtracted();

  return ({ asked, total }: { asked: number; total: number }): string =>
    t(
      "Questions on {asked, number} of {total, plural, one {# subject} other {# subjects}} so far",
      { asked, total },
    );
}

function EndLine({ end }: { end: SittingEnd | null }) {
  const t = useExtracted();

  if (end === "settled") {
    return t("Your starting points are set.");
  }

  return end === "noQuestionsReady"
    ? t("That's all the questions ready for now. Your next sessions ask the rest.")
    : null;
}

export function FocusTestEvidence({
  end = null,
  focusTest,
}: {
  end?: SittingEnd | null;
  focusTest: FocusTestView;
}) {
  const evidenceText = useEvidenceText();
  const { asked, total } = focusTest.counts;

  return (
    <div className="flex flex-col gap-1">
      <p className={SECTION_NOTE_CLASS}>{evidenceText({ asked, total })}</p>
      {(end === "settled" || end === "noQuestionsReady") && (
        <p className={SECTION_NOTE_CLASS} role="status">
          <EndLine end={end} />
        </p>
      )}
    </div>
  );
}

function StartingPoints({ lessonsSkipped }: { lessonsSkipped: number }) {
  const t = useExtracted();

  return (
    <PageSection>
      <PageSectionTitle>{t("Where you'll start")}</PageSectionTitle>
      <p className={SECTION_TEXT_CLASS}>
        {lessonsSkipped > 0
          ? t(
              "{count, plural, one {Your plan skips # lesson you already know.} other {Your plan skips # lessons you already know.}}",
              { count: lessonsSkipped },
            )
          : t("Your subjects start from the basics for now.")}
      </p>
    </PageSection>
  );
}

function FocusRows({ rows }: { rows: readonly FocusRow[] }) {
  const reasonText = useFocusReasonText();

  return (
    <ListGroup>
      <ul>
        {rows.map((row) => (
          <li key={row.subject.key}>
            <ListRow>
              <ListRowContent>
                <ListRowTitle>{getSubjectName(row.subject)}</ListRowTitle>
                <ListRowDescription>{reasonText(row)}</ListRowDescription>
              </ListRowContent>
            </ListRow>
          </li>
        ))}
      </ul>
    </ListGroup>
  );
}

function useFocusIntro() {
  const t = useExtracted();

  return (state: FocusTestFocus["state"]): string => {
    switch (state) {
      case "ifTimeShort":
        return t("If your time can't cover everything, your plan gives these more time.");
      case "proposed":
        return t("Your time can't cover everything. Your plan can give these more time.");
      case "current":
        return t("Your plan gives these more time.");
      case "handPicked":
        return t(
          "You chose your own focus, and your plan keeps it. This is what the test suggests.",
        );
      default:
        return state satisfies never;
    }
  };
}

function ProposalAnswer({
  canUndo,
  decision,
  isPending,
  onUndo,
}: {
  canUndo: boolean;
  decision: Decision;
  isPending: boolean;
  onUndo: () => void;
}) {
  const t = useExtracted();

  if (decision !== "applied") {
    return (
      <p className={SECTION_TEXT_CLASS} role="status">
        {decision === "undone"
          ? t("Undone. Your plan is back as it was.")
          : t("Your plan stays as it was.")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className={SECTION_TEXT_CLASS} role="status">
        {t("Done. Your plan now gives these more time.")}
      </p>
      {canUndo && (
        <Button
          busy={isPending}
          icon={<Undo2Icon aria-hidden="true" />}
          onClick={onUndo}
          size="sm"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      )}
    </div>
  );
}

function FocusProposal({ plan, proposal }: { plan: FocusTestPlanActions; proposal: Proposal }) {
  const t = useExtracted();
  const effectText = useProposalEffectText();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pressed, setPressed] = useState<Decision | null>(null);
  const effect = effectText(proposal, undefined, { besideDiff: true });

  const decide = (status: Decision) => {
    setPressed(status);

    startTransition(async () => {
      const saved = await plan.decide({ changeId: proposal.id, status }).catch(() => false);
      setFailed(!saved);

      if (saved) {
        setDecision(status);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {decision !== "applied" && (
        <>
          {effect && <p className={SECTION_NOTE_CLASS}>{effect}</p>}
          <PlanEffectDiff effect={proposal.effect} />
        </>
      )}

      {decision ? (
        <ProposalAnswer
          canUndo={proposal.canUndo}
          decision={decision}
          isPending={isPending}
          onUndo={() => decide("undone")}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {proposal.canApply && (
            <Button
              busy={isPending && pressed === "applied"}
              disabled={isPending}
              focusableWhenDisabled
              onClick={() => decide("applied")}
              size="sm"
            >
              {t("Update my plan")}
            </Button>
          )}
          <Button
            busy={isPending && pressed === "declined"}
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => decide("declined")}
            size="sm"
            variant="outline"
          >
            {t("Not now")}
          </Button>
        </div>
      )}

      {failed && <ChangeSaveError />}
    </div>
  );
}

function SuggestedFocus({
  focus,
  plan,
}: {
  focus: FocusTestFocus;
  plan: FocusTestPlanActions | null;
}) {
  const t = useExtracted();
  const intro = useFocusIntro();
  const space = useSentenceSpace();
  const changesFocus = plan && (focus.state === "current" || focus.state === "handPicked");

  if (focus.rows.length === 0) {
    return null;
  }

  return (
    <PageSection>
      <PageSectionTitle>{t("Suggested focus")}</PageSectionTitle>

      <p className={SECTION_NOTE_CLASS}>
        {intro(focus.state)}
        {focus.basis === "importance" && (
          <>
            {space}
            {t("For now, this follows mainly what counts most in your exam.")}
          </>
        )}
      </p>

      <FocusRows rows={focus.rows} />

      {plan && focus.state === "proposed" && focus.proposal && (
        <FocusProposal plan={plan} proposal={focus.proposal} />
      )}

      {changesFocus && (
        <LearnLink
          className={cn(buttonVariants({ variant: "link" }), "self-start")}
          href={plan.changeFocusHref}
        >
          {t("Change focus")}
        </LearnLink>
      )}
    </PageSection>
  );
}

export function FocusTestResult({
  focusTest,
  plan = null,
}: {
  focusTest: FocusTestView;
  plan?: FocusTestPlanActions | null;
}) {
  const t = useExtracted();
  const { checkpoint, counts, sessionQuestions, subjects } = focusTest;

  if (!checkpoint) {
    return null;
  }

  return (
    <>
      <StartingPoints lessonsSkipped={checkpoint.lessonsSkipped} />
      {checkpoint.focus && <SuggestedFocus focus={checkpoint.focus} plan={plan} />}

      <div className="flex flex-col items-start gap-2">
        <FocusTestSubjectsSheet answered subjects={subjects} />

        {sessionQuestions === "on" && counts.asked < counts.quick && (
          <p className={SECTION_NOTE_CLASS}>
            {t(
              "Your next sessions ask a few more questions, starting with subjects not asked yet.",
            )}
          </p>
        )}
      </div>
    </>
  );
}
