"use client";

import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionTitle } from "../_components/page";
import { useSentenceSpace } from "../_utils/locale";
import { LearnLink } from "../learn-link";
import { type SittingEnd } from "./focus-test-phase";
import { FocusProposal, type FocusTestPlanActions } from "./focus-test-proposal";
import { FocusTestSubjectsSheet } from "./focus-test-subjects";
import {
  getSubjectName,
  useFocusReasonText,
  useSessionQuestionsNote,
} from "./use-focus-test-texts";

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
                <ListRowDescription>{reasonText(row.reason)}</ListRowDescription>
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

  return function focusIntro(state: FocusTestFocus["state"]): string | null {
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
      case "declined":
        return t({
          description:
            "Shown above exam subjects the Focus test suggested giving more study time. The learner answered “Not now” or undid that change, so their study plan was left unchanged.",
          message: "You kept your plan as it is.",
        });
      case "suggested":
        return null;
      default:
        return state satisfies never;
    }
  };
}

function SuggestedFocus({
  focus,
  onProposalAnswered,
  plan,
  proposalAnswered,
}: {
  focus: FocusTestFocus;
  onProposalAnswered: () => void;
  plan: FocusTestPlanActions | null;
  /** The answer's own line says where the plan stands, so the note written for the offer goes. */
  proposalAnswered: boolean;
}) {
  const t = useExtracted();
  const intro = useFocusIntro();
  const space = useSentenceSpace();

  const changesFocus = plan && focus.state !== "ifTimeShort" && focus.state !== "proposed";

  const basis =
    focus.basis === "importance"
      ? t("For now, this follows mainly what counts most in your exam.")
      : null;

  const note = [proposalAnswered ? null : intro(focus.state), basis].filter(Boolean);

  if (focus.rows.length === 0) {
    return null;
  }

  return (
    <PageSection>
      <PageSectionTitle>{t("Suggested focus")}</PageSectionTitle>

      {note.length > 0 && <p className={SECTION_NOTE_CLASS}>{note.join(space)}</p>}

      <FocusRows rows={focus.rows} />

      {plan && focus.state === "proposed" && focus.proposal && (
        <FocusProposal onAnswered={onProposalAnswered} plan={plan} proposal={focus.proposal} />
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
  onProposalAnswered,
  plan,
  proposalAnswered,
}: {
  focusTest: FocusTestView;
  onProposalAnswered: () => void;
  plan: FocusTestPlanActions | null;
  proposalAnswered: boolean;
}) {
  const sessionQuestionsNote = useSessionQuestionsNote();
  const { checkpoint, sessionQuestions, subjects } = focusTest;

  if (!checkpoint) {
    return null;
  }

  return (
    <>
      <StartingPoints lessonsSkipped={checkpoint.lessonsSkipped} />
      {checkpoint.focus && (
        <SuggestedFocus
          focus={checkpoint.focus}
          onProposalAnswered={onProposalAnswered}
          plan={plan}
          proposalAnswered={proposalAnswered}
        />
      )}

      <div className="flex flex-col items-start gap-2">
        <FocusTestSubjectsSheet answered subjects={subjects} />

        {sessionQuestions === "on" && <p className={SECTION_NOTE_CLASS}>{sessionQuestionsNote}</p>}
      </div>
    </>
  );
}
