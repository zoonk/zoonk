import { tool } from "ai";
import type { z } from "zod";
import { chartInputSchema } from "./chart";
import chartPrompt from "./chart.prompt.md";
import { codeInputSchema } from "./code";
import codePrompt from "./code.prompt.md";
import { diagramInputSchema } from "./diagram";
import diagramPrompt from "./diagram.prompt.md";
import { imageInputSchema } from "./image";
import imagePrompt from "./image.prompt.md";
import { quoteInputSchema } from "./quote";
import quotePrompt from "./quote.prompt.md";
import { tableInputSchema } from "./table";
import tablePrompt from "./table.prompt.md";
import { timelineInputSchema } from "./timeline";
import timelinePrompt from "./timeline.prompt.md";

export const visualTools = {
  chart: tool({
    description: chartPrompt,
    inputSchema: chartInputSchema,
  }),
  code: tool({
    description: codePrompt,
    inputSchema: codeInputSchema,
  }),
  diagram: tool({
    description: diagramPrompt,
    inputSchema: diagramInputSchema,
  }),
  image: tool({
    description: imagePrompt,
    inputSchema: imageInputSchema,
  }),
  quote: tool({
    description: quotePrompt,
    inputSchema: quoteInputSchema,
  }),
  table: tool({
    description: tablePrompt,
    inputSchema: tableInputSchema,
  }),
  timeline: tool({
    description: timelinePrompt,
    inputSchema: timelineInputSchema,
  }),
};

export type ChartVisual = {
  kind: "chart";
} & z.infer<typeof chartInputSchema>;

export type CodeVisual = {
  kind: "code";
} & z.infer<typeof codeInputSchema>;

export type DiagramVisual = {
  kind: "diagram";
} & z.infer<typeof diagramInputSchema>;

export type ImageVisual = {
  kind: "image";
} & z.infer<typeof imageInputSchema>;

export type QuoteVisual = {
  kind: "quote";
} & z.infer<typeof quoteInputSchema>;

export type TableVisual = {
  kind: "table";
} & z.infer<typeof tableInputSchema>;

export type TimelineVisual = {
  kind: "timeline";
} & z.infer<typeof timelineInputSchema>;

export type StepVisualResource =
  | ChartVisual
  | CodeVisual
  | DiagramVisual
  | ImageVisual
  | QuoteVisual
  | TableVisual
  | TimelineVisual;
