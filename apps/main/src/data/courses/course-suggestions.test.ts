import { randomUUID } from "node:crypto";
import * as courseSuggestions from "@zoonk/ai/tasks/courses/suggestions";
import { prisma } from "@zoonk/db";
import { toSlug } from "@zoonk/utils/string";
import { expect, test, vi } from "vitest";
import {
  generateCourseSuggestions,
  getCourseSuggestionById,
  getCourseSuggestionBySlug,
} from "./course-suggestions";

test("get an existing item", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const language = "en";
  const uniqueId = randomUUID();
  const prompt = `typescript-${uniqueId}`;

  const suggestion = {
    description: "A course on TypeScript basics.",
    title: `TypeScript ${uniqueId}`,
  };

  const searchPrompt = await prisma.searchPrompt.create({
    data: { language, prompt },
  });

  const courseSuggestion = await prisma.courseSuggestion.create({
    data: {
      description: suggestion.description,
      language,
      slug: toSlug(suggestion.title),
      title: suggestion.title,
    },
  });

  await prisma.searchPromptSuggestion.create({
    data: {
      courseSuggestionId: courseSuggestion.id,
      position: 0,
      searchPromptId: searchPrompt.id,
    },
  });

  const result = await generateCourseSuggestions({ language, prompt });

  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]?.title).toBe(suggestion.title);
  expect(result.suggestions[0]?.id).toBe(courseSuggestion.id);
  expect(spy).not.toHaveBeenCalled();
});

test("generates a new item", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const language = "en";
  const prompt = `vitest-${randomUUID()}`;

  const generatedSuggestions = [
    { description: "A course on Vitest basics.", title: "Vitest" },
  ];

  spy.mockResolvedValueOnce({ data: generatedSuggestions } as never);

  const result = await generateCourseSuggestions({ language, prompt });

  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]?.title).toBe("Vitest");
  expect(result.suggestions[0]?.id).toBeTypeOf("number");
  expect(spy).toHaveBeenCalledOnce();

  // Verify item was created in database
  const dbItem = await prisma.courseSuggestion.findUnique({
    where: { languageSlug: { language, slug: toSlug("Vitest") } },
  });
  expect(dbItem).not.toBeNull();
  expect(dbItem?.title).toBe("Vitest");

  // Verify calling again returns cached result
  const cachedResult = await generateCourseSuggestions({ language, prompt });
  expect(cachedResult.suggestions[0]?.id).toBe(result.suggestions[0]?.id);
  expect(spy).toHaveBeenCalledOnce();
});

test("deduplicates suggestions across prompts", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const language = "en";
  const prompt1 = `dedupe-test-1-${randomUUID()}`;
  const prompt2 = `dedupe-test-2-${randomUUID()}`;

  const suggestions = [{ description: "Learn basics", title: "Common Course" }];

  spy.mockResolvedValue({ data: suggestions } as never);

  const result1 = await generateCourseSuggestions({
    language,
    prompt: prompt1,
  });
  const result2 = await generateCourseSuggestions({
    language,
    prompt: prompt2,
  });

  // Both should reference the same suggestion ID
  expect(result1.suggestions[0]?.id).toBe(result2.suggestions[0]?.id);

  // Only one suggestion should exist in database for this slug
  const items = await prisma.courseSuggestion.findMany({
    where: { language, slug: toSlug("Common Course") },
  });
  expect(items).toHaveLength(1);
});

test("getCourseSuggestionById returns null for non-existent id", async () => {
  const result = await getCourseSuggestionById(999_999);
  expect(result).toBeNull();
});

test("getCourseSuggestionById returns suggestion by id", async () => {
  const language = "en";
  const title = `by-id-${randomUUID()}`;
  const slug = toSlug(title);

  const item = await prisma.courseSuggestion.create({
    data: {
      description: "Test description",
      language,
      slug,
      title,
    },
  });

  const result = await getCourseSuggestionById(item.id);

  expect(result).toEqual({
    description: "Test description",
    generationRunId: null,
    generationStatus: "pending",
    language,
    slug,
    title,
  });
});

test("getCourseSuggestionBySlug returns null for non-existent slug", async () => {
  const result = await getCourseSuggestionBySlug({
    language: "en",
    slug: `non-existent-${randomUUID()}`,
  });
  expect(result).toBeNull();
});

test("getCourseSuggestionBySlug returns suggestion id by slug and language", async () => {
  const language = "en";
  const title = `by-slug-${randomUUID()}`;
  const slug = toSlug(title);

  const item = await prisma.courseSuggestion.create({
    data: {
      description: "Test description",
      language,
      slug,
      title,
    },
  });

  const result = await getCourseSuggestionBySlug({ language, slug });

  expect(result).toEqual({ id: item.id });
});

test("getCourseSuggestionBySlug distinguishes between languages", async () => {
  const slug = `multi-lang-${randomUUID()}`;

  const enItem = await prisma.courseSuggestion.create({
    data: {
      description: "English description",
      language: "en",
      slug,
      title: "English Title",
    },
  });

  const ptItem = await prisma.courseSuggestion.create({
    data: {
      description: "Portuguese description",
      language: "pt",
      slug,
      title: "Portuguese Title",
    },
  });

  const enResult = await getCourseSuggestionBySlug({ language: "en", slug });
  const ptResult = await getCourseSuggestionBySlug({ language: "pt", slug });

  expect(enResult).toEqual({ id: enItem.id });
  expect(ptResult).toEqual({ id: ptItem.id });
  expect(enResult?.id).not.toBe(ptResult?.id);
});
