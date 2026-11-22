import { aimForCharacters } from "@zoonk/utils/character-target";
import { z } from "zod";

/**
 * The app draws charts and timelines from data, so the numbers always match the text. The step
 * contract and stored items share this schema, so writers, checks and the player read one shape.
 */
const LABEL_TARGET = 40;
const TITLE_TARGET = 120;
const DETAIL_TARGET = 240;
const CHART_UNIT_TARGET = 12;

const label = aimForCharacters(z.string(), LABEL_TARGET);
const title = aimForCharacters(z.string(), TITLE_TARGET);
const MIN_CATEGORIES = 2;
const MIN_EVENTS = 2;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the kind first, then what the visual is about, then its data. */

const chartSeriesSchema = z.object({
  name: label,
  values: z.array(z.number()).min(MIN_CATEGORIES),
});

const chartVisualSchema = z.object({
  kind: z.literal("chart"),
  chart: z.enum(["bar", "line"]),
  title,
  categoryLabel: label,
  valueLabel: label,
  /** Null for plain counts. */
  unit: aimForCharacters(z.string(), CHART_UNIT_TARGET).nullable(),
  /** For a screen about a cropped axis; null lets the app choose (bars start at zero). */
  axisStart: z.number().nullable(),
  categories: z.array(label).min(MIN_CATEGORIES),
  series: z.array(chartSeriesSchema).min(1),
  /** Null for a made-up example. */
  source: title.nullable(),
});

const plotPointSchema = z.strictObject({ x: z.number(), y: z.number(), label: label.nullable() });

const plotVisualSchema = z.strictObject({
  kind: z.literal("plot"),
  title,
  xLabel: label,
  xUnit: aimForCharacters(z.string(), CHART_UNIT_TARGET).nullable(),
  yLabel: label,
  yUnit: aimForCharacters(z.string(), CHART_UNIT_TARGET).nullable(),
  series: z
    .array(
      z.strictObject({
        name: label,
        mark: z.enum(["points", "line", "lineWithPoints"]),
        points: z.array(plotPointSchema).min(1),
      }),
    )
    .min(1),
  references: z.array(z.strictObject({ label, y: z.number() })),
  source: title.nullable(),
});

const timelineVisualSchema = z.object({
  kind: z.literal("timeline"),
  title,
  events: z
    .array(
      z.object({
        date: label,
        label: title,
        detail: aimForCharacters(z.string(), DETAIL_TARGET).nullable(),
      }),
    )
    .min(MIN_EVENTS),
});

/* oxlint-enable eslint/sort-keys */

/**
 * A plain union, not a discriminated one: structured outputs accept `anyOf` but reject the `oneOf`
 * a discriminated union becomes.
 */
export const lessonVisualSchema = z.union([
  chartVisualSchema,
  timelineVisualSchema,
  plotVisualSchema,
]);

export const challengeVisualSchema = z.union([
  chartVisualSchema.strict().extend({ series: z.array(chartSeriesSchema.strict()).min(1) }),
  plotVisualSchema,
]);

export type LessonVisual = z.infer<typeof lessonVisualSchema>;
export type ChallengeVisual = z.infer<typeof challengeVisualSchema>;
export type PlotVisual = z.infer<typeof plotVisualSchema>;
export type ChartVisual = z.infer<typeof chartVisualSchema>;
export type TimelineVisual = z.infer<typeof timelineVisualSchema>;
