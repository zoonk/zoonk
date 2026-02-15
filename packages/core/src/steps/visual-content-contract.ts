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

const diagramVisualContentSchema = z
  .object({
    edges: z.array(diagramEdgeSchema),
    nodes: z.array(diagramNodeSchema),
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

const visualContentSchemas = {
  chart: chartVisualContentSchema,
  code: codeVisualContentSchema,
  diagram: diagramVisualContentSchema,
  image: imageVisualContentSchema,
  quote: quoteVisualContentSchema,
  table: tableVisualContentSchema,
  timeline: timelineVisualContentSchema,
} as const;

export type SupportedVisualKind = keyof typeof visualContentSchemas;

export type CodeVisualContent = z.infer<typeof codeVisualContentSchema>;
export type ChartVisualContent = z.infer<typeof chartVisualContentSchema>;
export type DiagramVisualContent = z.infer<typeof diagramVisualContentSchema>;
export type ImageVisualContent = z.infer<typeof imageVisualContentSchema>;
export type QuoteVisualContent = z.infer<typeof quoteVisualContentSchema>;
export type TableVisualContent = z.infer<typeof tableVisualContentSchema>;
export type TimelineVisualContent = z.infer<typeof timelineVisualContentSchema>;

export type VisualContentByKind = {
  chart: ChartVisualContent;
  code: CodeVisualContent;
  diagram: DiagramVisualContent;
  image: ImageVisualContent;
  quote: QuoteVisualContent;
  table: TableVisualContent;
  timeline: TimelineVisualContent;
};

export function isSupportedVisualKind(kind: string): kind is SupportedVisualKind {
  return Object.hasOwn(visualContentSchemas, kind);
}

export function parseVisualContent(kind: "chart", content: unknown): ChartVisualContent;
export function parseVisualContent(kind: "code", content: unknown): CodeVisualContent;
export function parseVisualContent(kind: "diagram", content: unknown): DiagramVisualContent;
export function parseVisualContent(kind: "image", content: unknown): ImageVisualContent;
export function parseVisualContent(kind: "quote", content: unknown): QuoteVisualContent;
export function parseVisualContent(kind: "table", content: unknown): TableVisualContent;
export function parseVisualContent(kind: "timeline", content: unknown): TimelineVisualContent;
export function parseVisualContent(
  kind: SupportedVisualKind,
  content: unknown,
): VisualContentByKind[SupportedVisualKind];
export function parseVisualContent(kind: SupportedVisualKind, content: unknown) {
  return visualContentSchemas[kind].parse(content);
}
