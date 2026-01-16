import { z } from "zod";

export const diagramInputSchema = z.object({
  edges: z
    .array(
      z.object({
        label: z.string().optional().describe("Optional edge label"),
        source: z.string().describe("Source node id (react-flow convention)"),
        target: z.string().describe("Target node id"),
      }),
    )
    .describe("Connections between nodes"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("Unique identifier"),
        label: z.string().describe("Display text (max 30 chars)"),
      }),
    )
    .describe("Diagram nodes"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
