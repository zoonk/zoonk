"use client";

import { getBreakEven } from "@zoonk/core/exams/net-score";
import { FlagIcon, GaugeIcon, ScaleIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
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
import { useFormatShare } from "../_utils/percent";
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
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
  const formatShare = useFormatShare();
  const { exam } = useExamScreen();
  const { rule, wrongPenalty } = exam.scoring;

  if (!rule) {
    return null;
  }

  switch (rule) {
    case "net":
      return {
        rule: t("Answer only when you're more than {share} sure.", {
          share: formatShare(getBreakEven(wrongPenalty)),
        }),
        title:
          wrongPenalty === 1
            ? t("A wrong answer cancels a right one")
            : t("A wrong answer costs {share} of a right one", {
                share: formatShare(wrongPenalty),
              }),
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

/**
 * What it takes to pass, as the notice says it (such as at least 40 of the 80 points), saying its
 * language when it isn't the learner's.
 */
function PassMarksRow() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { passMarks } = exam;
  const note = usePassMarksNote(passMarks);

  if (!passMarks) {
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
        {passMarks.texts.map((text) => (
          <ListRowDescription key={text} lang={passMarks.language}>
            {text}
          </ListRowDescription>
        ))}
        {note && <ListRowDescription>{note}</ListRowDescription>}
      </ListRowContent>
    </ListRow>
  );
}

/** The scale the notice says the exam reports its score on, with the score that passes on it. */
function NoticeScaleRow() {
  const t = useExtracted();
  const format = useFormatter();
  const { exam } = useExamScreen();
  const scale = exam.scoring.noticeScale;

  if (!scale) {
    return null;
  }

  return (
    <ListRow role="note">
      <ListRowLeading>
        <ListRowIcon>
          <GaugeIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>
          {scale.name
            ? t("Scored on the {name} scale", { name: scale.name })
            : t("Scored on its own scale")}
        </ListRowTitle>
        <ListRowDescription>
          {t("From {min} to {max}.", {
            max: format.number(scale.max),
            min: format.number(scale.min),
          })}
        </ListRowDescription>
        {scale.passScore !== null && (
          <ListRowDescription>
            {t("To pass: {score} or more.", { score: format.number(scale.passScore) })}
          </ListRowDescription>
        )}
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
 * "How the score works", as one list: the one scoring rule that changes how to answer, with the
 * learner's calibration after their mocks, the scale the notice reports on, what it takes to pass
 * as the notice says it, and where the bar was for the learner's target (its last cut-off).
 * Nothing when none of them applies.
 */
export function ExamScoringSection() {
  const t = useExtracted();
  const rule = useScoringRule();
  const { exam } = useExamScreen();

  if (!rule && !exam.cutoff && !exam.passMarks && !exam.scoring.noticeScale) {
    return null;
  }

  return (
    <PageSection aria-labelledby={SCORING_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={SCORING_TITLE_ID}>{t("How the score works")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {rule && <ScoringRuleRow rule={rule} />}
        <NoticeScaleRow />
        <PassMarksRow />
        <TargetCutoffRow cutoff={exam.cutoff} targetScore={exam.targetScore} />
      </ListGroup>
    </PageSection>
  );
}
