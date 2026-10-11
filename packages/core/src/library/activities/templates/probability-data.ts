import { z } from "zod";
import { idSchema, labelSchema, uniqueIdsSchema } from "../../steps/contract/content-schemas";
import { unitSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { normalCdf } from "./_utils/probability";
import { issue } from "./_utils/template-helpers";

const MAX_POINTS = 200;
const MAX_SPANS = 6;
const PERCENT = 100;

const intervalSchema = z.object({ from: z.number(), to: z.number() }).strict();

const distributionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("normal"), mean: z.number(), sd: z.number().positive() }).strict(),
  z.object({ kind: z.literal("uniform"), max: z.number(), min: z.number() }).strict(),
]);

type Distribution = z.output<typeof distributionSchema>;

function cumulative(distribution: Distribution, value: number): number {
  if (distribution.kind === "normal") {
    return normalCdf({ mean: distribution.mean, sd: distribution.sd, value });
  }

  const share = (value - distribution.min) / (distribution.max - distribution.min);

  return Math.min(Math.max(share, 0), 1);
}

export const distributionExplorerTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Drag two handles along a distribution and read the percent of values between them, with the tails outside. Code computes the percent (0 to 100) inside `target`; a numeric check's answer is that percent, and the handles start away from the target so the learner moves them there. Fills: the distribution and its parameters, units and source, the starting handles, the target range and the check question.",
  fields: z
    .object({
      distribution: distributionSchema,
      handles: intervalSchema,
      target: intervalSchema,
      unit: unitSchema,
      valueLabel: labelSchema,
    })
    .strict(),
  id: "distributionExplorer",
  needsData: true,
  value: (fields) =>
    (cumulative(fields.distribution, fields.target.to) -
      cumulative(fields.distribution, fields.target.from)) *
    PERCENT,
  verify: (fields) =>
    [
      fields.handles.from >= fields.handles.to &&
        issue("inconsistentFields", "fields.handles", "The handles must go from low to high"),
      fields.target.from >= fields.target.to &&
        issue("inconsistentFields", "fields.target", "The target must go from low to high"),
      fields.distribution.kind === "uniform" &&
        fields.distribution.min >= fields.distribution.max &&
        issue("inconsistentFields", "fields.distribution", "The range must go from low to high"),
      fields.handles.from === fields.target.from &&
        fields.handles.to === fields.target.to &&
        issue("missingInteraction", "fields.handles", "The handles already sit on the target"),
    ].filter((item) => item !== false),
});

const chartPointSchema = z.object({ x: z.number(), y: z.number() }).strict();

const chartReaderFields = z
  .object({
    points: z.array(chartPointSchema).min(3).max(MAX_POINTS),
    spans: uniqueIdsSchema(
      z.object({ from: z.number(), id: idSchema, label: labelSchema, to: z.number() }).strict(),
      { max: MAX_SPANS, min: 1 },
    ),
    statistic: z.enum(["change", "percentChange", "ratePerUnit"]),
    xLabel: labelSchema,
    yLabel: labelSchema,
    yUnit: unitSchema.optional(),
  })
  .strict();

type ChartReaderFields = z.output<typeof chartReaderFields>;

function measureSpan(fields: ChartReaderFields, spanId: string | null): number | null {
  const span = spanId ? fields.spans.find((item) => item.id === spanId) : fields.spans[0];
  const start = fields.points.find((point) => point.x === span?.from)?.y;
  const end = fields.points.find((point) => point.x === span?.to)?.y;

  if (!span || start === undefined || end === undefined) {
    return null;
  }

  if (fields.statistic === "change") {
    return end - start;
  }

  if (fields.statistic === "ratePerUnit") {
    return (end - start) / (span.to - span.from);
  }

  return start === 0 ? null : ((end - start) / start) * PERCENT;
}

function chartIssues(fields: ChartReaderFields) {
  const xs = fields.points.map((point) => point.x);

  return [
    xs.some((x, index) => index > 0 && x <= (xs[index - 1] ?? x)) &&
      issue("inconsistentFields", "fields.points", "Points must be sorted by x without repeats"),
    ...fields.spans.map(
      (span, index) =>
        (span.from >= span.to || !xs.includes(span.from) || !xs.includes(span.to)) &&
        issue(
          "inconsistentFields",
          `fields.spans.${index}`,
          "A span must start and end on data points",
        ),
    ),
  ].filter((item) => item !== false);
}

export const chartReaderTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Measure spans on a real chart to see a trend, like the rise of CO₂ speeding up. Code measures the span named in `output` (or the first) with the chosen statistic. Fills: the dataset and its source, axis labels, which spans can be measured, the check question and the why.",
  fields: chartReaderFields,
  id: "chartReader",
  needsData: true,
  value: (fields, target) => measureSpan(fields, target.output),
  verify: (fields) => chartIssues(fields),
});
