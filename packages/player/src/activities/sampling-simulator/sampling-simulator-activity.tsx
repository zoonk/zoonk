"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { hashSeed } from "@zoonk/utils/seeded-random";
import { RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { useReducedMotion } from "../_utils/use-reduced-motion";
import { useRevealCount } from "../_utils/use-reveal-count";
import { type ActivityRendererProps } from "../activity-renderer";
import {
  histogram,
  middleRange,
  samplingDomain,
  simulateSamples,
  truthOf,
  valueDigits,
} from "./sampling";
import { SamplingChart } from "./sampling-chart";
import { SamplingExpectedSpread } from "./sampling-expected-spread";
import { SamplingSizeSlider } from "./sampling-size-slider";
import { useSamplingFormat } from "./use-sampling-format";

type SamplingSimulatorProps = ActivityRendererProps<"samplingSimulator">;

function useRuns({
  content,
  runIndex,
  size,
}: {
  content: SamplingSimulatorProps["content"];
  runIndex: number;
  size: number;
}) {
  const { population, runs } = content.fields;
  const seed = hashSeed(`${JSON.stringify(content.fields)}:${size}`) + runIndex;

  return {
    results: useMemo(
      () => simulateSamples({ population, runs, seed, size }),
      [population, runs, seed, size],
    ),
    seed,
  };
}

/**
 * Run many samples of each size and watch the results bunch up around the truth as samples grow.
 * The runs are seeded by the lesson, so everyone sees the same first runs, and they fill in over
 * about a second (all at once with reduced motion). The chosen size is drawn over the smallest,
 * so the narrowing is seen, and the middle 95% of results gives the margin of error.
 */
export function SamplingSimulatorActivity({ content, labelId, phase }: SamplingSimulatorProps) {
  const t = useExtracted();
  const reducedMotion = useReducedMotion();
  const { fields } = content;
  const { format, formatMargin, formatSize, formatValue } = useSamplingFormat(fields);
  const [sizeIndex, setSizeIndex] = useState(fields.sampleSizes.length - 1);
  const [runIndex, setRunIndex] = useState(0);
  const isChecked = phase === "checked";
  const smallest = fields.sampleSizes[0] ?? 1;
  const size = fields.sampleSizes[sizeIndex] ?? smallest;
  const domain = samplingDomain(fields.population, smallest);
  const truth = truthOf(fields.population);
  const selected = useRuns({ content, runIndex, size });
  const baseline = useRuns({ content, runIndex, size: smallest });

  const revealed = useRevealCount({
    instant: reducedMotion,
    runKey: selected.seed,
    total: fields.runs,
  });

  const shown = selected.results.slice(0, revealed);
  const isDone = shown.length === selected.results.length;
  const range = middleRange(selected.results);
  const margin = (range[1] - range[0]) / 2;
  const digits = valueDigits({ margin, population: fields.population });
  const formatResult = (value: number) => formatValue(value, digits);
  const bins = histogram(shown, domain);
  const comparison = size === smallest ? null : histogram(baseline.results, domain);

  const maxCount = Math.max(
    ...histogram(selected.results, domain).map((bin) => bin.count),
    ...(comparison ?? []).map((bin) => bin.count),
    1,
  );

  const sizeLabel = fields.sizeLabel ?? t("Sample size");

  const summary = t(
    "{runs} samples of {size} from {population}. The true value is {truth}; 95% of samples landed between {from} and {to}.",
    {
      from: formatResult(range[0]),
      population: fields.populationLabel,
      runs: format(fields.runs),
      size: formatSize(size),
      to: formatResult(range[1]),
      truth: formatResult(truth),
    },
  );

  return (
    <ActivityCanvas labelId={labelId}>
      {/* The margin moves under its label when both don't fit, like "±5,3 Prozentpunkte" on a phone. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <ActivityCanvasLabel className="text-sm">
            {t("95% of samples land within")}
          </ActivityCanvasLabel>
          <ActivityCanvasLabel>{fields.populationLabel}</ActivityCanvasLabel>
        </div>

        <ActivityReadout
          aria-hidden="true"
          className={cn(
            "whitespace-nowrap motion-safe:transition-colors",
            isDone ? "text-viz-accent" : "text-muted-foreground",
          )}
        >
          {formatMargin(margin)}
        </ActivityReadout>
      </div>

      <SamplingChart
        comparison={comparison}
        domain={domain}
        format={formatResult}
        maxCount={maxCount}
        range={range}
        rangeLabel={t("{from} to {to}", {
          from: formatResult(range[0]),
          to: formatResult(range[1]),
        })}
        results={bins}
        truth={truth}
        truthLabel={t("True value: {value}", { value: formatResult(truth) })}
      />

      {comparison && (
        <div
          aria-hidden="true"
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums"
        >
          <span className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/30 size-2.5 rounded-sm" />
            {formatSize(smallest)}
          </span>
          <span className="text-foreground flex items-center gap-1.5 font-medium">
            <span className="bg-viz-accent size-2.5 rounded-sm" />
            {formatSize(size)}
          </span>
        </div>
      )}

      <SamplingSizeSlider
        disabled={isChecked}
        index={sizeIndex}
        label={sizeLabel}
        onIndexChange={setSizeIndex}
        sizeLabels={fields.sampleSizes.map((item) => formatSize(item))}
        valueText={t("{size}. 95% of samples within {margin}.", {
          margin: formatMargin(margin),
          size: formatSize(size),
        })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm tabular-nums">
          {/* Only the finished run is announced; the count while it fills in would be noise. */}
          <span aria-live="polite">
            {isDone &&
              t("{runs} samples of {size}", { runs: format(fields.runs), size: formatSize(size) })}
          </span>
          {!isDone && (
            <span aria-hidden="true">
              {t("Running {count} of {runs}…", {
                count: format(shown.length),
                runs: format(fields.runs),
              })}
            </span>
          )}
        </p>

        <Button
          disabled={!isDone}
          onClick={() => setRunIndex(runIndex + 1)}
          className="min-h-11"
          size="lg"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" />
          {t("Run again")}
        </Button>
      </div>

      {isChecked && <SamplingExpectedSpread content={content} />}

      <ActivityTextAlternative>{summary}</ActivityTextAlternative>
    </ActivityCanvas>
  );
}
