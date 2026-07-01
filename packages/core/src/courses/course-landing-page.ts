import { z } from "zod";

const courseLandingPageContentSchema = z.object({
  audience: z.array(z.string()),
  opportunities: z.array(z.string()),
  outcomes: z.array(z.string()),
  valueProposition: z.string(),
});

export type CourseLandingPageContent = z.infer<typeof courseLandingPageContentSchema>;

/**
 * Parses the JSON stored in Course.landingPage without depending on the AI task
 * that originally produced the first version of that content. The stored course
 * page contract can evolve separately from future generation prompts or output
 * schemas.
 */
export function parseCourseLandingPageContent(value: unknown): CourseLandingPageContent | null {
  const result = courseLandingPageContentSchema.safeParse(value);
  return result.success ? result.data : null;
}
