"use client";

import { type WritingPrompt, type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { estimateWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { useExtracted, useFormatter } from "next-intl";
import {
  LabeledStepTitle,
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
} from "../_components/step-card";
import { useFormatScore } from "../essay/essay-labels";
import { getMinimumPoints, getMinimumShare } from "./minimum-points";
import { MinimumLegend, PointsMeter, PointsReadout } from "./points-readout";
import { useFormatPointsRange } from "./writing-labels";

type Points = Extract<WritingResult, { kind: "points" }>;

function PartMinimum({
  answerMax,
  part,
}: {
  answerMax: number;
  part: NonNullable<WritingPrompt["partMinimum"]>;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const formatScore = useFormatScore();
  const share = getMinimumShare(part);
  const points = getMinimumPoints(part);

  if (part.max !== answerMax && points !== null) {
    const minimum = formatScore(points);

    return (
      <p className="text-muted-foreground text-xs">
        {part.max === null
          ? t("Minimum to pass the written test: {minimum} points in total", { minimum })
          : t("Minimum to pass the written test: {minimum} of {max} points in total", {
              max: formatScore(part.max),
              minimum,
            })}
      </p>
    );
  }

  if (share === null) {
    return null;
  }

  const label = t("Minimum to pass the written test: {share} of the points", {
    share: format.number(share, { maximumFractionDigits: 0, style: "percent" }),
  });

  return part.max === answerMax ? (
    <MinimumLegend>{label}</MinimumLegend>
  ) : (
    <p className="text-muted-foreground text-xs">{label}</p>
  );
}

/** The total as a range on the question's scale, then what it's made of, so the parts never contradict it. */
export function PointsHeader({
  grade,
  prompt,
  text,
}: {
  grade: Points;
  prompt: WritingPrompt;
  text: string;
}) {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const minimum = prompt.partMinimum;
  const errors = grade.errors.length;

  const estimatedLines =
    grade.estimatedLines ??
    estimateWritingLines({ charactersPerLine: prompt.charactersPerLine, text });

  return (
    <StepCard className="items-stretch">
      <StepHeader>
        <LabeledStepTitle label={t("Your answer")}>
          <PointsReadout decimals={grade.decimals} max={grade.max} range={grade.total} />
        </LabeledStepTitle>
        <StepDetail className="text-sm">{t("Estimated score")}</StepDetail>
      </StepHeader>

      <div className="flex flex-col gap-3">
        <PointsMeter
          max={grade.max}
          minimumShare={minimum?.max === grade.max ? getMinimumShare(minimum) : null}
          range={grade.total}
        />
        {minimum && <PartMinimum answerMax={grade.max} part={minimum} />}
      </div>

      {grade.zeroReason ? (
        <p className="text-pretty" role="note">
          {grade.zeroReason}
        </p>
      ) : (
        <StepRows>
          <StepRow>
            <span className="min-w-0 flex-1">{t("Content")}</span>
            <span className="font-mono text-xs tabular-nums">
              {formatRange(grade.content, { decimals: grade.decimals })}
            </span>
          </StepRow>
          <StepRow>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span>{t("Language errors")}</span>
              <span className="text-muted-foreground text-xs">
                {[
                  t("{count, plural, one {# error} other {# errors}}", { count: errors }),
                  prompt.lines === null
                    ? t("{count, plural, one {about # line} other {about # lines}}", {
                        count: estimatedLines,
                      })
                    : t("about {used} of {lines} lines", {
                        lines: String(prompt.lines),
                        used: String(estimatedLines),
                      }),
                ].join(" · ")}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums">
              {formatRange(grade.deduction, { kind: "deduction" })}
            </span>
          </StepRow>
        </StepRows>
      )}
    </StepCard>
  );
}
