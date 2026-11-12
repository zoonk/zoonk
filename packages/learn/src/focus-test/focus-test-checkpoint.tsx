"use client";

import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ListGroup, ListRow, ListRowContent, ListRowTitle } from "../_components/list-group";
import { PageSection, PageSectionTitle } from "../_components/page";
import { LearnLink } from "../learn-link";
import { FocusProposal, type FocusTestPlanActions } from "./focus-test-proposal";
import { FocusTestSubjectsSheet } from "./focus-test-subjects";
import { getSubjectName, useSessionQuestionsNote } from "./use-focus-test-texts";

const SECTION_TEXT_CLASS = "text-sm text-pretty";
const SECTION_NOTE_CLASS = "text-muted-foreground text-sm text-pretty";

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
  return (
    <ListGroup>
      <ul>
        {rows.map((row) => (
          <li key={row.subject.key}>
            <ListRow>
              <ListRowContent>
                <ListRowTitle>{getSubjectName(row.subject)}</ListRowTitle>
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
  const changesFocus = plan && focus.state !== "ifTimeShort" && focus.state !== "proposed";
  const note = proposalAnswered ? null : intro(focus.state);

  if (focus.rows.length === 0) {
    return null;
  }

  return (
    <PageSection>
      <PageSectionTitle>{t("Suggested focus")}</PageSectionTitle>

      {note && <p className={SECTION_NOTE_CLASS}>{note}</p>}

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
