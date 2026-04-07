"use client";

import { useExtracted } from "next-intl";
import {
  type InvestigationScoreDimensions,
  getInvestigationScoreDimensions,
} from "../compute-score";
import { extractInvestigationScoreInput } from "../investigation";
import { usePlayerRuntime } from "../player-context";
import { SectionLabel } from "./section-label";

const INVESTIGATION_EXCELLENT_THRESHOLD = 25;
const INVESTIGATION_GOOD_THRESHOLD = 15;
const INVESTIGATION_FAIR_THRESHOLD = 10;

const ANALYSIS_SHARP_THRESHOLD = 25;
const ANALYSIS_SOLID_THRESHOLD = 15;
const ANALYSIS_DEVELOPING_THRESHOLD = 10;

const CALL_NAILED_THRESHOLD = 40;
const CALL_CLOSE_THRESHOLD = 20;

/**
 * Translates the investigation dimension score into a label and
 * description using the i18n hook. Thresholds match the spec:
 * >=25 "Excellent", >=15 "Good", >=10 "Fair", <10 "Weak".
 */
function useInvestigationDimensionLabel(score: number) {
  const t = useExtracted();

  if (score >= INVESTIGATION_EXCELLENT_THRESHOLD) {
    return { description: t("You picked the most informative actions"), label: t("Excellent") };
  }

  if (score >= INVESTIGATION_GOOD_THRESHOLD) {
    return { description: t("You picked useful actions"), label: t("Good") };
  }

  if (score >= INVESTIGATION_FAIR_THRESHOLD) {
    return { description: t("Some of your investigation choices could improve"), label: t("Fair") };
  }

  return {
    description: t("Try picking actions that test your hunch more directly"),
    label: t("Weak"),
  };
}

/**
 * Translates the analysis dimension score into a label and description.
 * >=25 "Sharp", >=15 "Solid", >=10 "Developing", <10 "Needs work".
 */
function useAnalysisDimensionLabel(score: number) {
  const t = useExtracted();

  if (score >= ANALYSIS_SHARP_THRESHOLD) {
    return { description: t("You read the evidence carefully"), label: t("Sharp") };
  }

  if (score >= ANALYSIS_SOLID_THRESHOLD) {
    return { description: t("You interpreted evidence well"), label: t("Solid") };
  }

  if (score >= ANALYSIS_DEVELOPING_THRESHOLD) {
    return { description: t("Work on reading evidence more carefully"), label: t("Developing") };
  }

  return { description: t("Focus on what the evidence actually shows"), label: t("Needs work") };
}

/**
 * Translates the call dimension score into a label and description.
 * 40 "Nailed it", 20 "Close", 0 "Not quite".
 */
function useCallDimensionLabel(score: number) {
  const t = useExtracted();

  if (score >= CALL_NAILED_THRESHOLD) {
    return { description: t("You identified what happened"), label: t("Nailed it") };
  }

  if (score >= CALL_CLOSE_THRESHOLD) {
    return {
      description: t("You were on the right track but missed the full picture"),
      label: t("Close"),
    };
  }

  return { description: t("The evidence pointed in a different direction"), label: t("Not quite") };
}

function DimensionBlock({
  description,
  heading,
  label,
}: {
  description: string;
  heading: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{heading}</p>

      <p className="text-sm font-semibold">{label}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function ScoreDimensions({ dimensions }: { dimensions: InvestigationScoreDimensions }) {
  const t = useExtracted();
  const investigation = useInvestigationDimensionLabel(dimensions.investigationScore);
  const analysis = useAnalysisDimensionLabel(dimensions.analysisScore);
  const call = useCallDimensionLabel(dimensions.callScore);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <DimensionBlock
        description={investigation.description}
        heading={t("Your approach")}
        label={investigation.label}
      />

      <DimensionBlock
        description={analysis.description}
        heading={t("Your reads")}
        label={analysis.label}
      />

      <DimensionBlock description={call.description} heading={t("Your call")} label={call.label} />
    </div>
  );
}

/**
 * Score screen for the investigation activity.
 *
 * Renders three qualitative dimension blocks (investigation,
 * analysis, final call) with a hero total score. No progress bars,
 * cards, or borders — just typography and whitespace.
 *
 * Reads scoring data from player state via the investigation loop
 * and step content. Falls back gracefully if scoring data is
 * unavailable (shouldn't happen in normal play).
 */
export function InvestigationScoreContent() {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const input = extractInvestigationScoreInput(state);

  if (!input) {
    return null;
  }

  const dimensions = getInvestigationScoreDimensions(input);
  const total = dimensions.investigationScore + dimensions.analysisScore + dimensions.callScore;

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-8">
      <SectionLabel>{t("Debrief")}</SectionLabel>

      <div className="flex flex-col items-center gap-1">
        <p className="text-5xl font-bold tracking-tight tabular-nums">{total}</p>
        <p className="text-muted-foreground text-sm">/100</p>
      </div>

      <ScoreDimensions dimensions={dimensions} />
    </div>
  );
}
