import { z } from "zod";

/**
 * Charts and timelines a lesson screen or a question shows as data, drawn by the app instead of
 * described in words: the app draws the axes, bars, lines and dates from these fields, so the
 * numbers always match the text. Tables are Markdown in the screen's text, and pictures are image
 * requests drawn by an image model; this covers what neither does well. The step contract and
 * stored items share this schema, so writers, checks and the player read one shape.
 */
const MAX_LABEL_LENGTH = 40;
const MAX_TITLE_LENGTH = 120;
const MAX_DETAIL_LENGTH = 240;
const MAX_UNIT_LENGTH = 12;
const MIN_CATEGORIES = 2;
const MAX_CATEGORIES = 12;
const MAX_SERIES = 3;
const MIN_EVENTS = 2;
const MAX_EVENTS = 8;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the kind first, then what the visual is about, then its data. */

/**
 * A bar or line chart of real or clearly example data: `categories` along the bottom in order
 * (months, years, groups) and one to three `series` with one value per category.
 */
const chartVisualSchema = z.object({
  kind: z.literal("chart"),
  chart: z.enum(["bar", "line"]),
  title: z.string().max(MAX_TITLE_LENGTH),
  categoryLabel: z.string().max(MAX_LABEL_LENGTH),
  valueLabel: z.string().max(MAX_LABEL_LENGTH),
  /** The values' unit ("%", "R$", "kg"), or null for plain counts. */
  unit: z.string().max(MAX_UNIT_LENGTH).nullable(),
  /**
   * Where the value axis starts, for a screen about a cropped axis; null lets the app choose (bars
   * start at zero).
   */
  axisStart: z.number().nullable(),
  categories: z.array(z.string().max(MAX_LABEL_LENGTH)).min(MIN_CATEGORIES).max(MAX_CATEGORIES),
  series: z
    .array(
      z.object({
        name: z.string().max(MAX_LABEL_LENGTH),
        values: z.array(z.number()).min(MIN_CATEGORIES).max(MAX_CATEGORIES),
      }),
    )
    .min(1)
    .max(MAX_SERIES),
  /** Where real data comes from ("IBGE, Censo 2022"), or null for a made-up example. */
  source: z.string().max(MAX_TITLE_LENGTH).nullable(),
});

/** Dated events in order, each with what happened and, when it helps, one line of detail. */
const timelineVisualSchema = z.object({
  kind: z.literal("timeline"),
  title: z.string().max(MAX_TITLE_LENGTH),
  events: z
    .array(
      z.object({
        date: z.string().max(MAX_LABEL_LENGTH),
        label: z.string().max(MAX_TITLE_LENGTH),
        detail: z.string().max(MAX_DETAIL_LENGTH).nullable(),
      }),
    )
    .min(MIN_EVENTS)
    .max(MAX_EVENTS),
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
