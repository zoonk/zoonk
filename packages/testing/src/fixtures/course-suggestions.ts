import { randomUUID } from "node:crypto";
import { type CourseSuggestion, prisma } from "@zoonk/db";

export function courseSuggestionAttrs(
  attrs?: Partial<CourseSuggestion>,
): Omit<CourseSuggestion, "id" | "createdAt" | "updatedAt"> {
  return {
    description: "Test course suggestion description",
    generationRunId: null,
    generationStatus: "pending",
    language: "en",
    slug: `test-suggestion-${randomUUID()}`,
    targetLanguage: null,
    title: "Test Course Suggestion",
    ...attrs,
  };
}

export async function courseSuggestionFixture(attrs?: Partial<CourseSuggestion>) {
  const suggestion = await prisma.courseSuggestion.create({
    data: courseSuggestionAttrs(attrs),
  });
  return suggestion;
}
