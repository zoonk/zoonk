import { z } from "zod";

export type ActivitySteps = { title: string; text: string }[];

const stepContentSchema = z.object({
  text: z.string(),
  title: z.string(),
});

export function parseActivitySteps(steps: { content: unknown }[]): ActivitySteps {
  return steps.map((step) => stepContentSchema.parse(step.content));
}
