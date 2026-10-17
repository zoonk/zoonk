"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { cellMatches, isFillable } from "@zoonk/core/library/activities/combination-grid";
import { getActivityTemplate } from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { GridBoard } from "./grid-board";
import { GridCaption } from "./grid-caption";
import {
  type GridFields,
  type GridFill,
  cellOptions,
  completeFill,
  fillShare,
  gridCells,
  nextEmptyCell,
} from "./grid-model";
import { GridPalette } from "./grid-palette";

type CombinationGridProps = ActivityRendererProps<"combinationGrid">;
type Content = CombinationGridProps["content"];

/** What the check counts: its `output`, or the recessive trait on a Punnett grid. */
function checkOutput({ check, fields }: Content): string | null {
  const fallback = fields.rule === "alleles" ? "recessive" : null;
  return check.kind === "interaction" ? fallback : (check.output ?? fallback);
}

/** The right values, computed by core from the rows and columns. */
function expectedCells(content: Content): string[] {
  const expected = getActivityTemplate(content.template)?.computeExpected(content.fields);
  return expected?.kind === "grid" ? expected.cells : [];
}

/** A numeric check reads the share from the learner's fill; an interaction grades the full grid. */
function answerFor({ content, fill }: { content: Content; fill: GridFill }): ActivityAnswer | null {
  const output = checkOutput(content);

  if (content.check.kind === "numeric") {
    const share = output === null ? null : fillShare(fill, output);
    return share === null ? null : { kind: "numeric", value: share };
  }

  const complete = completeFill(fill);

  return content.check.kind === "interaction" && complete
    ? { cells: complete, kind: "grid" }
    : null;
}

/**
 * The cells the check's question counts, marked once checked (none for a filled-in grid, which is
 * graded cell by cell).
 */
function countedCells({
  content,
  output,
  right,
}: {
  content: Content;
  output: string | null;
  right: readonly string[];
}): ReadonlySet<number> {
  if (content.check.kind === "interaction" || output === null) {
    return new Set();
  }

  return new Set(right.flatMap((cell, index) => (cellMatches(cell, output) ? [index] : [])));
}

function initialFill(answer: CombinationGridProps["answer"], size: number): GridFill {
  return answer?.kind === "grid" && answer.cells.length === size
    ? answer.cells
    : Array.from({ length: size }, () => null);
}

/** How the check's output reads: the trait it names on a Punnett grid, or the value itself. */
function outputName(fields: GridFields, output: string | null): string | null {
  if (fields.rule !== "alleles" || output === null) {
    return output;
  }

  if (output === "dominant") {
    return fields.traits.dominant;
  }

  return output === "recessive" ? fields.traits.recessive : output;
}

function useGridDescription(fields: GridFields): string {
  const t = useExtracted();

  const place = {
    columnLabel: fields.columns.label,
    columnValues: fields.columns.values.join(", "),
    rowLabel: fields.rows.label,
    rowValues: fields.rows.values.join(", "),
  };

  if (fields.rule === "alleles") {
    return t(
      "A Punnett square for {trait}: {rowParent} ({rowAlleles}) down the side, {columnParent} ({columnAlleles}) across the top.",
      {
        columnAlleles: fields.columns.values.join(""),
        columnParent: fields.columns.label,
        rowAlleles: fields.rows.values.join(""),
        rowParent: fields.rows.label,
        trait: fields.title,
      },
    );
  }

  return fields.rule === "sum"
    ? t(
        "{title}: {rowLabel} ({rowValues}) down the side, {columnLabel} ({columnValues}) across the top, each square their sum.",
        { ...place, title: fields.title },
      )
    : t(
        "{title}: {rowLabel} ({rowValues}) down the side, {columnLabel} ({columnValues}) across the top, each square their product.",
        { ...place, title: fields.title },
      );
}

/**
 * A grid where every cell combines its row and its column: a Punnett square's alleles, two dice
 * added, a times table. A small grid the learner fills cell by cell: the two values of the cell
 * being filled light up, and a tally follows. A bigger one is shown filled, to read and count. A
 * numeric check reads the share of cells its question asks about from the learner's own fill.
 * Explored on an explanation screen, the grid is filled in, with nothing to pick.
 */
export function CombinationGridActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: CombinationGridProps) {
  const { fields } = content;
  const description = useGridDescription(fields);
  const cells = gridCells(fields);
  const right = expectedCells(content);
  const isAllele = fields.rule === "alleles";
  const traits = fields.rule === "alleles" ? fields.traits : null;
  const isReadOnly = phase === "explore" || !isFillable(fields);

  const [fill, setFill] = useState<GridFill>(() =>
    isReadOnly ? right : initialFill(answer, cells.length),
  );

  const [activeCell, setActiveCell] = useState(() => nextEmptyCell(fill, null));
  const isChecked = phase === "checked";
  const isLocked = isChecked || isReadOnly;
  const output = checkOutput(content);

  function handlePick(value: string) {
    if (activeCell === null) {
      return;
    }

    const next = fill.map((cell, index) => (index === activeCell ? value : cell));
    setFill(next);
    setActiveCell(nextEmptyCell(next, activeCell));

    if (content.check.kind !== "choice") {
      onAnswerChange(answerFor({ content, fill: next }));
    }
  }

  const counted = isChecked ? countedCells({ content, output, right }) : null;

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <GridBoard
        activeCell={isLocked ? null : activeCell}
        cells={cells}
        checked={counted ? { counted, expected: right } : null}
        columnLabel={fields.columns.label}
        // A grid shown to read has no fill of the learner's to mark once checked.
        fill={isChecked && isReadOnly ? cells.map(() => null) : fill}
        isAllele={isAllele}
        onSelectCell={isLocked ? null : setActiveCell}
        rowLabel={fields.rows.label}
        traits={traits}
      />

      {(!isReadOnly || (counted && counted.size > 0) || (isAllele && phase === "explore")) && (
        <GridCaption
          counted={counted && content.check.kind !== "interaction" ? counted.size : null}
          expected={isChecked && !isReadOnly ? right : []}
          fill={fill}
          outputName={outputName(fields, output)}
          traits={traits}
        />
      )}

      {!isLocked && (
        <GridPalette
          activeCell={activeCell}
          isAllele={isAllele}
          onPick={handlePick}
          options={cellOptions(fields, right)}
          traits={traits}
        />
      )}

      <ActivityTextAlternative>{description}</ActivityTextAlternative>
    </ActivityCanvas>
  );
}
