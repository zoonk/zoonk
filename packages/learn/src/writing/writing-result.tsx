"use client";

import { type WritingPrompt, type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { Eyebrow } from "../_components/eyebrow";
import { PageSectionFooter, PageSectionTitle } from "../_components/page";
import {
  LabeledStepTitle,
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
} from "../_components/step-card";
import { useFormatRange } from "../_utils/range";
import { ESSAY_QUOTE_CLASS, useFormatScore } from "../essay/essay-labels";
import { MinimumLegend, PointsMeter, PointsReadout, getMinimumShare } from "./points-readout";
import {
  LEVEL_CELLS,
  LEVEL_CELL_COUNT,
  useFormatPointsRange,
  useLevelName,
} from "./writing-labels";
import { NextStepCard, NothingLeftComment } from "./writing-next-step";
import { WritingMarkedText } from "./writing-text";

type Points = Extract<WritingResult, { kind: "points" }>;

/** "−0.3–0.6": what language errors take away, as a range like the rest. */
function useFormatDeduction() {
  const formatRange = useFormatPointsRange();

  return (deduction: Points["deduction"]) =>
    deduction.high > 0 ? `−${formatRange(deduction)}` : formatRange(deduction);
}

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
function PointsHeader({
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
  const formatDeduction = useFormatDeduction();
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
          <PointsReadout max={grade.max} range={grade.total} />
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
            <span className="font-mono text-xs tabular-nums">{formatRange(grade.content)}</span>
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
              {formatDeduction(grade.deduction)}
            </span>
          </StepRow>
        </StepRows>
      )}
    </StepCard>
  );
}

function WritingNextStep({ grade }: { grade: WritingResult }) {
  const t = useExtracted();
  const { nextStep } = grade;

  if (!nextStep) {
    return <NothingLeftComment />;
  }

  const criterion = grade.criteria.find(({ id }) => id === nextStep.criterionId);

  return (
    <NextStepCard
      example={nextStep.example}
      quote={nextStep.quote}
      text={nextStep.text}
      title={criterion?.name ?? t("What to rewrite")}
    />
  );
}

/** What a rewrite changed, by criterion: only after a second version. */
function WritingProgress({ grade }: { grade: WritingResult }) {
  const t = useExtracted();
  const name = (id: string) => grade.criteria.find((criterion) => criterion.id === id)?.name ?? id;
  const fixed = grade.progress?.fixed ?? [];
  const persists = grade.progress?.persists ?? [];

  if (fixed.length === 0 && persists.length === 0) {
    return null;
  }

  return (
    <StepRows aria-label={t("Since your last version")}>
      {fixed.length > 0 && (
        <StepRow>
          <span className="text-success-text min-w-0 flex-1">
            {t("Fixed: {criteria}", { criteria: fixed.map((id) => name(id)).join(", ") })}
          </span>
        </StepRow>
      )}
      {persists.length > 0 && (
        <StepRow>
          <span className="text-muted-foreground min-w-0 flex-1">
            {t("Still to work on: {criteria}", {
              criteria: persists.map((id) => name(id)).join(", "),
            })}
          </span>
        </StepRow>
      )}
    </StepRows>
  );
}

/** A criterion's points: what's sure in full, what the range leaves open in light. */
function RowMeter({ max, range }: { max: number; range: { high: number; low: number } }) {
  const low = Math.min(1, range.low / max);
  const high = Math.min(1, range.high / max);

  return (
    <MeterParts className="w-16 shrink-0 sm:w-20">
      {low > 0 && <MeterPart className="bg-foreground" weight={low} />}
      {high > low && <MeterPart className="bg-foreground/30" weight={high - low} />}
      {high < 1 && <MeterPart weight={1 - high} />}
    </MeterParts>
  );
}

function LevelCells({ level }: { level: WritingResult["criteria"][number]["level"] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-0.5">
      {Array.from({ length: LEVEL_CELL_COUNT }, (_, index) => (
        <span
          className={cn(
            "rounded-meter size-2",
            index < LEVEL_CELLS[level] ? "bg-success" : "bg-surface-3",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- a fixed row of cells
          key={index}
        />
      ))}
    </span>
  );
}

function CriterionComments({ grade }: { grade: WritingResult }) {
  return (
    <ul className="flex flex-col gap-4">
      {grade.criteria.map((criterion) => (
        <li className="flex flex-col gap-1 text-sm" key={criterion.id}>
          <p className="font-semibold">{criterion.name}</p>
          {criterion.quote && (
            <blockquote
              className={cn(ESSAY_QUOTE_CLASS, "text-muted-foreground border-border italic")}
            >
              {criterion.quote}
            </blockquote>
          )}
          <p className="text-pretty">{criterion.comment}</p>
        </li>
      ))}
    </ul>
  );
}

function useCriteriaSource(prompt: WritingPrompt, grade: WritingResult): string | null {
  const t = useExtracted();

  if (grade.kind === "levels" && prompt.criteria.every(({ points }) => points === null)) {
    return t("The exam notice doesn't say how many points each criterion is worth.");
  }

  if (grade.kind === "levels") {
    return null;
  }

  return prompt.keySource === "notice"
    ? t("Criteria and points from the exam notice.")
    : t("Criteria and points from the exam notice. The answer key is ours, for practice.");
}

function WritingCriteria({ grade, prompt }: { grade: WritingResult; prompt: WritingPrompt }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const formatRange = useFormatRange();
  const levelName = useLevelName();
  const source = useCriteriaSource(prompt, grade);

  return (
    <section className="flex flex-col gap-3" data-slot="writing-criteria">
      <PageSectionTitle>{t("Criteria")}</PageSectionTitle>
      <StepRows aria-label={t("Score by criterion")}>
        {grade.criteria.map((criterion) => {
          const row =
            grade.kind === "points" ? grade.rows.find(({ id }) => id === criterion.id) : null;

          return (
            <StepRow key={criterion.id}>
              <span className="min-w-0 flex-1 text-pretty">{criterion.name}</span>
              {row ? (
                <>
                  <RowMeter
                    max={row.max}
                    range={row.range ?? { high: row.earned, low: row.earned }}
                  />
                  <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                    {t("{score} of {max}", {
                      max: formatScore(row.max),
                      score: row.range
                        ? formatRange(formatScore(row.range.low), formatScore(row.range.high))
                        : formatScore(row.earned),
                    })}
                  </span>
                </>
              ) : (
                <>
                  <LevelCells level={criterion.level} />
                  <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
                    {levelName(criterion.level)}
                  </span>
                </>
              )}
            </StepRow>
          );
        })}
      </StepRows>
      <DetailsDrawer label={t("See comments")} title={t("Comments")} trigger="small">
        <CriterionComments grade={grade} />
      </DetailsDrawer>
      {source && <PageSectionFooter>{source}</PageSectionFooter>}
    </section>
  );
}

/**
 * A graded written answer: with a scale, the range, its parts and the passage to rewrite; without
 * one, no total, the one change that helps most and a level per criterion. Then the text as sent.
 */
export function WritingResultView({
  eyebrow,
  grade,
  prompt,
  text,
}: {
  /** Which answer this is, where a result shows several (a written test). */
  eyebrow?: string | null;
  grade: WritingResult;
  prompt: WritingPrompt;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-10" data-slot="writing-result">
      <div className="flex flex-col gap-6">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {grade.kind === "points" && <PointsHeader grade={grade} prompt={prompt} text={text} />}
        <WritingProgress grade={grade} />
        <WritingNextStep grade={grade} />
      </div>
      <WritingCriteria grade={grade} prompt={prompt} />
      <WritingMarkedText grade={grade} lines={prompt.lines} text={text} />
    </div>
  );
}
