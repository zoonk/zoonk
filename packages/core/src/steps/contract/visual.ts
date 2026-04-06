import { z } from "zod";

const codeAnnotationSchema = z
  .object({
    line: z.number(),
    text: z.string(),
  })
  .strict();

export const codeVisualContentSchema = z
  .object({
    annotations: z.array(codeAnnotationSchema).optional(),
    code: z.string(),
    language: z.string(),
  })
  .strict();

const chartDataPointSchema = z
  .object({
    name: z.string(),
    value: z.number(),
  })
  .strict();

export const chartVisualContentSchema = z
  .object({
    chartType: z.enum(["bar", "line", "pie"]),
    data: z.array(chartDataPointSchema),
    title: z.string(),
  })
  .strict();

const diagramNodeSchema = z
  .object({
    id: z.string(),
    label: z.string(),
  })
  .strict();

const diagramEdgeSchema = z
  .object({
    label: z.string().optional(),
    source: z.string(),
    target: z.string(),
  })
  .strict();

export const diagramVisualContentSchema = z
  .object({
    edges: z.array(diagramEdgeSchema),
    nodes: z.array(diagramNodeSchema),
  })
  .strict();

export const formulaVisualContentSchema = z
  .object({
    description: z.string(),
    formula: z.string(),
  })
  .strict();

export const musicVisualContentSchema = z
  .object({
    abc: z.string(),
    description: z.string(),
  })
  .strict();

export const imageVisualContentSchema = z
  .object({
    prompt: z.string(),
    url: z.string().optional(),
  })
  .strict();

export const quoteVisualContentSchema = z
  .object({
    author: z.string(),
    canVerify: z.boolean().optional(),
    text: z.string(),
  })
  .strict();

export const tableVisualContentSchema = z
  .object({
    caption: z.string().optional(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })
  .strict();

const timelineEventSchema = z
  .object({
    date: z.string(),
    description: z.string(),
    title: z.string(),
  })
  .strict();

export const timelineVisualContentSchema = z
  .object({
    events: z.array(timelineEventSchema),
  })
  .strict();

const chartVisualStepSchema = chartVisualContentSchema.extend({ kind: z.literal("chart") });
const codeVisualStepSchema = codeVisualContentSchema.extend({ kind: z.literal("code") });
const diagramVisualStepSchema = diagramVisualContentSchema.extend({ kind: z.literal("diagram") });
const formulaVisualStepSchema = formulaVisualContentSchema.extend({ kind: z.literal("formula") });
const musicVisualStepSchema = musicVisualContentSchema.extend({ kind: z.literal("music") });
const imageVisualStepSchema = imageVisualContentSchema.extend({ kind: z.literal("image") });
const quoteVisualStepSchema = quoteVisualContentSchema.extend({ kind: z.literal("quote") });
const tableVisualStepSchema = tableVisualContentSchema.extend({ kind: z.literal("table") });
const timelineVisualStepSchema = timelineVisualContentSchema.extend({
  kind: z.literal("timeline"),
});

export const visualStepContentSchema = z.discriminatedUnion("kind", [
  chartVisualStepSchema,
  codeVisualStepSchema,
  diagramVisualStepSchema,
  formulaVisualStepSchema,
  imageVisualStepSchema,
  musicVisualStepSchema,
  quoteVisualStepSchema,
  tableVisualStepSchema,
  timelineVisualStepSchema,
]);

export type VisualStepContent = z.infer<typeof visualStepContentSchema>;

export type ChartVisualContent = z.infer<typeof chartVisualContentSchema>;
export type CodeVisualContent = z.infer<typeof codeVisualContentSchema>;
export type DiagramVisualContent = z.infer<typeof diagramVisualContentSchema>;
export type FormulaVisualContent = z.infer<typeof formulaVisualContentSchema>;
export type ImageVisualContent = z.infer<typeof imageVisualContentSchema>;
export type MusicVisualContent = z.infer<typeof musicVisualContentSchema>;
export type QuoteVisualContent = z.infer<typeof quoteVisualContentSchema>;
export type TableVisualContent = z.infer<typeof tableVisualContentSchema>;
export type TimelineVisualContent = z.infer<typeof timelineVisualContentSchema>;
