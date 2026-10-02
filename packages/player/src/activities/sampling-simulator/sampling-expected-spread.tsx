"use client";

import { useExtracted } from "next-intl";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";
import { useSamplingFormat } from "./use-sampling-format";

type Content = ActivityRendererProps<"samplingSimulator">["content"];

const PERCENT = 100;
/** 95% of a normal curve sits within this many standard errors of the middle. */
const MIDDLE_95 = 1.96;

/**
 * After the check, the margin each sample size should give, worked out from the standard error
 * by core (the same numbers that grade the check), next to what the runs showed.
 */
export function SamplingExpectedSpread({ content }: { content: Content }) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { fields } = content;
  const { formatMargin, formatSize } = useSamplingFormat(fields);
  const ratio = computeActivityValue(content);
  const [smallest, largest] = [fields.sampleSizes[0] ?? 1, fields.sampleSizes.at(-1) ?? 1];

  const margins = fields.sampleSizes.map((size) => ({
    margin:
      (computeActivityValue(content, { inputs: { sampleSize: size }, output: "standardError" }) ??
        0) * MIDDLE_95,
    size,
  }));

  return (
    <div className="bg-background flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm">
      <p className="font-medium">{t("What the math says")}</p>

      <ul className="flex flex-col gap-1 tabular-nums">
        {margins.map((item) => (
          <li className="flex justify-between gap-3" key={item.size}>
            <span className="text-muted-foreground">{formatSize(item.size)}</span>
            <span className="font-medium">{formatMargin(item.margin)}</span>
          </li>
        ))}
      </ul>

      {ratio !== null && (
        <p className="text-muted-foreground leading-snug">
          {t("From {smallest} to {largest}, the margin shrinks to {share} of its size.", {
            largest: formatSize(largest),
            share: format(ratio * PERCENT, { maximumFractionDigits: 1, unit: "%" }),
            smallest: formatSize(smallest),
          })}
        </p>
      )}
    </div>
  );
}
