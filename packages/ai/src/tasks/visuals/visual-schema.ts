import { aimForCharacters } from "@zoonk/utils/character-target";
import { z } from "zod";

/**
 * The app draws charts and timelines from data, so the numbers always match the text. The step
 * contract and stored items share this schema, so writers, checks and the player read one shape.
 */
const LABEL_TARGET = 40;
const TITLE_TARGET = 120;
const DETAIL_TARGET = 240;
export const CHART_UNIT_TARGET = 12;

const label = aimForCharacters(z.string(), LABEL_TARGET);
const title = aimForCharacters(z.string(), TITLE_TARGET);
const MIN_CATEGORIES = 2;
const MIN_EVENTS = 2;
/** The app has three series colors, and dropping a series could drop what a question asks about. */
const MAX_SERIES = 3;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the kind first, then what the visual is about, then its data. */

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
  series: z
    .array(z.object({ name: label, values: z.array(z.number()).min(MIN_CATEGORIES) }))
    .min(1)
    .max(MAX_SERIES),
  /** Null for a made-up example. */
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
 * a discriminated union becomes. `kind` still tells the two apart.
 */
export const lessonVisualSchema = z.union([chartVisualSchema, timelineVisualSchema]);

export type LessonVisual = z.infer<typeof lessonVisualSchema>;
export type ChartVisual = z.infer<typeof chartVisualSchema>;
export type TimelineVisual = z.infer<typeof timelineVisualSchema>;
