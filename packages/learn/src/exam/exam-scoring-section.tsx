"use client";

import { FlagIcon, ScaleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { useExamScreen } from "./exam-context";
import { TargetCutoffRow } from "./target-cutoff";

const SCORING_TITLE_ID = "exam-scoring-title";

/** Cebraspe: how often the learner is right when sure and when unsure, across their mocks. */
function Calibration() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { calibration } = exam;

  if (!calibration || calibration.sure.answered + calibration.unsure.answered === 0) {
    return null;
  }

  return (
    <>
      <ListRowDescription className="text-foreground pt-1">
        {t(
          "In your mock exams: sure, {sureRight} of {sureAnswered} right. Unsure, {unsureRight} of {unsureAnswered} right.",
          {
            sureAnswered: String(calibration.sure.answered),
            sureRight: String(calibration.sure.right),
            unsureAnswered: String(calibration.unsure.answered),
            unsureRight: String(calibration.unsure.right),
          },
        )}
      </ListRowDescription>
      {calibration.advice === "blankUnsure" && (
        <ListRowDescription>
          {t("Your unsure answers cost more than they earn: leave those blank.")}
        </ListRowDescription>
      )}
      {calibration.advice === "keepAnswering" && (
        <ListRowDescription>
          {t("Your unsure answers still earn points: keep answering them.")}
        </ListRowDescription>
      )}
    </>
  );
}

/**
 * How the method scores, as a title, and what to do about it: only when the notice says how the
 * exam is scored, never from the mocks' default (a class test from the learner's material).
 */
function useScoringRule(): { rule: string; title: string } | null {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (!exam.scoring.stated) {
    return null;
  }

  switch (exam.scoring.method) {
    case "net":
      return {
        rule: t("Answer only when you're more than 50% sure."),
        title: t("A wrong answer cancels a right one"),
      };
    case "irt":
      return {
        rule: t(
          "Missing an easy question costs more than missing a hard one, so solve the easy ones first.",
        ),
        title: t("Getting the easy ones right counts more"),
      };
    case "raw":
      return { rule: t("Answer every question."), title: t("Each right answer counts one point") };
    default:
      return null;
  }
}

/** What it takes to pass, as the notice says it ("Aprovado com no mínimo 40 dos 80 pontos"). */
function PassMarksRow() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.passMarks.length === 0) {
    return null;
  }

  return (
    <ListRow role="note">
      <ListRowLeading>
        <ListRowIcon>
          <FlagIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("To pass")}</ListRowTitle>
        {exam.passMarks.map((passMark) => (
          <ListRowDescription key={passMark}>{passMark}</ListRowDescription>
        ))}
      </ListRowContent>
    </ListRow>
  );
}

function ScoringRuleRow({ rule }: { rule: { rule: string; title: string } }) {
  return (
    <ListRow role="note">
      <ListRowLeading>
        <ListRowIcon>
          <ScaleIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{rule.title}</ListRowTitle>
        <ListRowDescription>{rule.rule}</ListRowDescription>
        <Calibration />
      </ListRowContent>
    </ListRow>
  );
}

/**
 * "How the score works", as one list: what it takes to pass as the notice says it, where the bar
 * was for the learner's target (its last cut-off), and the one scoring rule that changes how to
 * answer, with the learner's calibration after their mocks. Nothing when none of them applies.
 */
export function ExamScoringSection() {
  const t = useExtracted();
  const rule = useScoringRule();
  const { exam } = useExamScreen();

  if (!rule && !exam.cutoff && exam.passMarks.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={SCORING_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={SCORING_TITLE_ID}>{t("How the score works")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {rule && <ScoringRuleRow rule={rule} />}
        <PassMarksRow />
        <TargetCutoffRow cutoff={exam.cutoff} targetScore={exam.targetScore} />
      </ListGroup>
    </PageSection>
  );
}
