"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { cellMatches } from "@zoonk/core/library/activities/punnett-square";
import { getActivityTemplate } from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { PunnettCaption } from "./punnett-caption";
import { PunnettGrid } from "./punnett-grid";
import {
  type PunnettFill,
  completeFill,
  fillShare,
  genotypeOptions,
  nextEmptyCell,
  punnettCells,
} from "./punnett-model";
import { PunnettPalette } from "./punnett-palette";

type PunnettProps = ActivityRendererProps<"punnettSquare">;
type Content = PunnettProps["content"];

const DEFAULT_OUTPUT = "recessive";

/** What the check counts: its `output`, or the recessive trait as core defaults to. */
function checkOutput(content: Content): string {
  return content.check.kind === "interaction"
    ? DEFAULT_OUTPUT
    : (content.check.output ?? DEFAULT_OUTPUT);
}

/** The right genotypes, computed by core from the parents' alleles. */
function expectedCells(content: Content): string[] {
  const expected = getActivityTemplate(content.template)?.computeExpected(content.fields);
  return expected?.kind === "grid" ? expected.cells : [];
}

/** A numeric check reads the learner's share; an interaction check grades the full square. */
function answerFor({
  content,
  fill,
}: {
  content: Content;
  fill: PunnettFill;
}): ActivityAnswer | null {
  if (content.check.kind === "numeric") {
    const share = fillShare(fill, checkOutput(content));
    return share === null ? null : { kind: "numeric", value: share };
  }

  const complete = completeFill(fill);

  return content.check.kind === "interaction" && complete
    ? { cells: complete, kind: "grid" }
    : null;
}

function initialFill(answer: PunnettProps["answer"], size: number): PunnettFill {
  return answer?.kind === "grid" && answer.cells.length === size
    ? answer.cells
    : Array.from({ length: size }, () => null);
}

function useOutputName(content: Content) {
  const { phenotypes } = content.fields;
  const output = checkOutput(content);

  if (output === "dominant") {
    return phenotypes.dominant;
  }

  return output === "recessive" ? phenotypes.recessive : output;
}

/**
 * A Punnett square the learner fills in: each square gets one allele from each parent. The two
 * alleles of the square being filled light up, and a tally counts each trait as squares fill. A
 * numeric check reads the share of squares its question asks about from the learner's own fill.
 */
export function PunnettSquareActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: PunnettProps) {
  const t = useExtracted();
  const { parents, phenotypes, trait } = content.fields;
  const cells = punnettCells(parents);
  const [fill, setFill] = useState(() => initialFill(answer, cells.length));
  const [activeCell, setActiveCell] = useState(() => nextEmptyCell(fill, null));
  const isChecked = phase === "checked";
  const output = checkOutput(content);
  const outputName = useOutputName(content);
  const expected = isChecked ? expectedCells(content) : [];

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

  const counted = new Set(
    expected.flatMap((cell, index) => (cellMatches(cell, output) ? [index] : [])),
  );

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <PunnettGrid
        activeCell={isChecked ? null : activeCell}
        cells={cells}
        checked={
          isChecked
            ? { counted: content.check.kind === "interaction" ? new Set() : counted, expected }
            : null
        }
        fill={fill}
        onSelectCell={setActiveCell}
        parents={parents}
        phenotypes={phenotypes}
      />

      <PunnettCaption
        counted={isChecked && content.check.kind !== "interaction" ? counted.size : null}
        expected={expected}
        fill={fill}
        outputName={outputName}
        phenotypes={phenotypes}
      />

      {!isChecked && (
        <PunnettPalette
          activeCell={activeCell}
          onPick={handlePick}
          options={genotypeOptions(parents)}
          phenotypes={phenotypes}
        />
      )}

      <ActivityTextAlternative>
        {t(
          "A Punnett square for {trait}: {rowParent} ({rowAlleles}) down the side, {columnParent} ({columnAlleles}) across the top.",
          {
            columnAlleles: parents[1]?.alleles.join("") ?? "",
            columnParent: parents[1]?.label ?? "",
            rowAlleles: parents[0]?.alleles.join("") ?? "",
            rowParent: parents[0]?.label ?? "",
            trait,
          },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
