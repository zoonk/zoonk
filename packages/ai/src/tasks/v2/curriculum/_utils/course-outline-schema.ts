import { z } from "zod";

const lessonSchema = z.object({
  canDo: z.string(),
  description: z.string(),
  estimatedMinutes: z.number(),
  skills: z.array(z.string()),
  title: z.string(),
});

const toolSchema = z.object({ essential: z.boolean(), name: z.string() });

export const chapterSchema = z.object({
  description: z.string(),
  lessons: z.array(lessonSchema),
  objectives: z.array(z.string()),
  skillKeys: z.array(z.string()),
  title: z.string(),
  tools: z.array(toolSchema),
});
