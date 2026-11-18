import { z } from "zod";

const courseLandingPageContentSchema = z.object({
  audience: z.array(z.string()),
  outcomes: z.array(z.string()),
  valueProposition: z.string(),
});

export type CourseLandingPageContent = z.infer<typeof courseLandingPageContentSchema>;

/** Returns null for invalid stored content; the storage contract is independent of generation schemas. */
export function parseCourseLandingPageContent(value: unknown): CourseLandingPageContent | null {
  const result = courseLandingPageContentSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getCoursePromise({
  description,
  landingPage,
}: {
  description: string | null;
  landingPage: unknown;
}): string | null {
  return parseCourseLandingPageContent(landingPage)?.valueProposition || description;
}
