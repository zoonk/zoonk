"use client";

import { type WritingPrompt, type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { useExtracted, useFormatter } from "next-intl";
import {
  LabeledStepTitle,
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
} from "../_components/step-card";
import { getMinimumShare } from "./minimum-points";
import { MinimumLegend, PointsMeter, PointsReadout } from "./points-readout";
import { useFormatPointsRange } from "./writing-labels";

type Points = Extract<WritingResult, { kind: "points" }>;

/** The written test's minimum, drawn on this question's scale at the same share of its points. */
function PartMinimum({ prompt }: { prompt: WritingPrompt }) {
  const t = useExtracted();
  const format = useFormatter();
  const share = prompt.partMinimum && getMinimumShare(prompt.partMinimum);

  if (share === null || share === undefined) {
    return null;
  }

  return (
    <MinimumLegend>
      {t("Minimum to pass the written test: {share} of the points", {
        share: format.number(share, { maximumFractionDigits: 0, style: "percent" }),
      })}
    </MinimumLegend>
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
    countWritingLines({ charactersPerLine: prompt.charactersPerLine, limit: prompt.lines, text })
      .estimatedLines;

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
          minimumShare={minimum ? getMinimumShare(minimum) : null}
          range={grade.total}
        />
        <PartMinimum prompt={prompt} />
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
              {formatRange(grade.deduction, { decimals: grade.decimals, deduction: true })}
            </span>
          </StepRow>
        </StepRows>
      )}
    </StepCard>
  );
}
