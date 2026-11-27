"use client";

import { type WritingPrompt, type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { PageSectionFooter, PageSectionTitle } from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
import { ESSAY_QUOTE_CLASS, useFormatScore } from "../essay/essay-labels";
import { fixedDecimals } from "./format-points-range";
import { getNextStep } from "./next-step";
import {
  LEVEL_CELLS,
  LEVEL_CELL_COUNT,
  useFormatPointsRange,
  useLevelName,
} from "./writing-labels";
import { NextStepCard, NothingLeftComment } from "./writing-next-step";
import { PointsHeader } from "./writing-points-header";
import { WritingMarkedText } from "./writing-text";
import { useZeroStepCopy } from "./writing-zero-step";

type Points = Extract<WritingResult, { kind: "points" }>;

function WritingNextStep({
  grade,
  lines,
  text,
}: {
  grade: WritingResult;
  lines: number | null;
  text: string;
}) {
  const t = useExtracted();
  const zeroCopy = useZeroStepCopy();
  const step = getNextStep({ grade, text });

  if (step.kind === "done") {
    return <NothingLeftComment />;
  }

  if (step.kind === "short") {
    return (
      <NextStepCard
        example={null}
        quote={null}
        text={t("This answer is too short to grade. Add more and send it again.")}
        title={t("Write a longer answer")}
      />
    );
  }

  if (step.kind === "limit") {
    return (
      <NextStepCard
        example={null}
        quote={null}
        text={
          lines
            ? t("Even in small handwriting, it runs past line {lines}, where graders stop.", {
                lines: String(lines),
              })
            : t("Even in small handwriting, it runs past the line limit, where graders stop.")
        }
        title={
          lines
            ? t("Fit it in {lines} lines", { lines: String(lines) })
            : t("Fit it in the line limit")
        }
      />
    );
  }

  if (step.kind === "zero") {
    const copy = zeroCopy(step.zeroKind);

    return (
      <NextStepCard
        example={null}
        quote={null}
        text={copy?.text ?? (step.text || t("Rewrite it following the rule above."))}
        title={copy?.title ?? t("Answer the question asked")}
      />
    );
  }

  return (
    <NextStepCard
      example={step.example}
      quote={step.quote}
      text={step.text}
      title={step.title ?? t("What to rewrite")}
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
          <p>{criterion.comment}</p>
        </li>
      ))}
    </ul>
  );
}

function useCriteriaFooter(prompt: WritingPrompt, grade: WritingResult): string | null {
  const t = useExtracted();

  if (grade.kind === "levels" && prompt.criteria.every(({ points }) => points === null)) {
    return t("The exam notice doesn't say how many points each criterion is worth.");
  }

  // An answer on a sheet with points can still come back by level, even after one with points.
  if (grade.kind === "levels") {
    return t("Graded by level: we can't yet estimate this answer's points closely enough.");
  }

  return prompt.keySource === "notice"
    ? t("Criteria and points from the exam notice.")
    : t("Criteria and points from the exam notice. The answer key is ours, for practice.");
}

function WritingCriteria({ grade, prompt }: { grade: WritingResult; prompt: WritingPrompt }) {
  const t = useExtracted();
  const format = useFormatter();
  const formatScore = useFormatScore();
  const formatPoints = useFormatPointsRange();
  const levelName = useLevelName();
  const footer = useCriteriaFooter(prompt, grade);
  const rows = grade.kind === "points" ? grade.rows : [];

  const scoreLabel = (row: Points["rows"][number]) => {
    const decimals = row.decimals ?? (grade.kind === "points" ? grade.decimals : undefined);

    return t("{score} of {max}", {
      max:
        decimals === undefined
          ? formatScore(row.max)
          : format.number(row.max, fixedDecimals(decimals)),
      score: formatPoints(row.range ?? { high: row.earned, low: row.earned }, { decimals }),
    });
  };

  // One width for every score, so the meters before them line up whether a row is a range or not.
  const scoreWidth = `${Math.max(0, ...rows.map((row) => scoreLabel(row).length))}ch`;

  return (
    <section className="flex flex-col gap-3" data-slot="writing-criteria">
      <PageSectionTitle>{t("Criteria")}</PageSectionTitle>
      <StepRows aria-label={t("Score by criterion")}>
        {grade.criteria.map((criterion) => {
          const row = rows.find(({ id }) => id === criterion.id);

          return (
            <StepRow key={criterion.id}>
              <span className="min-w-0 flex-1 text-pretty">{criterion.name}</span>
              {row ? (
                <>
                  <RowMeter
                    max={row.max}
                    range={row.range ?? { high: row.earned, low: row.earned }}
                  />
                  <span
                    className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums"
                    style={{ minWidth: scoreWidth }}
                  >
                    {scoreLabel(row)}
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
      {footer && <PageSectionFooter>{footer}</PageSectionFooter>}
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
  note,
  prompt,
  text,
}: {
  /** Which answer this is, where a result shows several (a written test). */
  eyebrow?: string | null;
  grade: WritingResult;
  note?: React.ReactNode;
  prompt: WritingPrompt;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-10" data-slot="writing-result">
      <div className="flex flex-col gap-6">
        {/* A heading, not a chip: one chip sits over a title, and the next step has its own. */}
        {(eyebrow || note) && (
          <div className="flex flex-col gap-1">
            {eyebrow && <PageSectionTitle>{eyebrow}</PageSectionTitle>}
            {note}
          </div>
        )}
        {grade.kind === "points" && <PointsHeader grade={grade} prompt={prompt} text={text} />}
        {/* A zeroed answer's one step is the rule it broke: no criterion to compare yet. */}
        {getNextStep({ grade, text }).kind !== "zero" && <WritingProgress grade={grade} />}
        <WritingNextStep grade={grade} lines={prompt.lines} text={text} />
      </div>
      <WritingCriteria grade={grade} prompt={prompt} />
      <WritingMarkedText grade={grade} prompt={prompt} text={text} />
    </div>
  );
}
