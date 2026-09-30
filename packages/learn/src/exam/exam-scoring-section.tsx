"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useExamScreen } from "./exam-context";

/** Cebraspe: how often the learner is right when sure and when unsure, across their mocks. */
function Calibration() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { calibration } = exam;

  if (!calibration || calibration.sure.answered + calibration.unsure.answered === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {t(
          "In your mock exams: sure, {sureRight} of {sureAnswered} right. Unsure, {unsureRight} of {unsureAnswered} right.",
          {
            sureAnswered: String(calibration.sure.answered),
            sureRight: String(calibration.sure.right),
            unsureAnswered: String(calibration.unsure.answered),
            unsureRight: String(calibration.unsure.right),
          },
        )}
      </p>
      {calibration.advice === "blankUnsure" && (
        <p className="text-muted-foreground">
          {t("Your unsure answers cost more than they earn: leave those blank.")}
        </p>
      )}
      {calibration.advice === "keepAnswering" && (
        <p className="text-muted-foreground">
          {t("Your unsure answers still earn points: keep answering them.")}
        </p>
      )}
    </div>
  );
}

type Strategy = { advice: string; method: string };

/** How the method scores in plain words, and what to do about it. */
function useStrategy(): Strategy {
  const t = useExtracted();
  const { exam } = useExamScreen();

  switch (exam.scoring.method) {
    case "net":
      return {
        advice: t(
          "Answer only when you're more than 50% sure; otherwise leave it blank. Flag the ones you're unsure of in mock exams to track this.",
        ),
        method: t("A wrong answer cancels a right one."),
      };
    case "irt":
      return {
        advice: t(
          "Missing easy questions costs more than missing hard ones, so secure the easy ones first.",
        ),
        method: t(
          "Scored with item response theory: a right answer counts more when your pattern is consistent.",
        ),
      };
    case "raw":
      return {
        advice: t("Answer every question."),
        method: t("Each right answer counts one point."),
      };
    default:
      return { advice: "", method: exam.scoring.method };
  }
}

/** How the exam is scored, in the board's words when there are any, and what to do about it. */
export function ExamScoringSection() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const strategy = useStrategy();

  return (
    <section
      aria-labelledby="exam-scoring-title"
      className="bg-muted/60 in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-3xl p-5"
    >
      <div className="flex items-start gap-3">
        <LineMarker aria-hidden="true">
          <LightbulbIcon className="text-warning size-5" />
        </LineMarker>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="in-data-[mode=fun]:font-fun-display font-semibold" id="exam-scoring-title">
            {t("How it's scored")}
          </h2>
          {/* The board's own words replace the plain-words method, so it isn't said twice. */}
          <p className="text-muted-foreground text-sm">{exam.scoring.note ?? strategy.method}</p>
          {strategy.advice && <p className="text-sm">{strategy.advice}</p>}
        </div>
      </div>
      <Calibration />
    </section>
  );
}
