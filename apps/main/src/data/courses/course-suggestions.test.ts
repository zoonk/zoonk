import { randomUUID } from "node:crypto";
import * as courseSuggestions from "@zoonk/ai/course-suggestions/generate";
import { prisma } from "@zoonk/db";
import { expect, test, vi } from "vitest";
import {
  generateCourseSuggestions,
  getCourseSuggestionById,
} from "./course-suggestions";

test("get an existing item", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const language = "en";
  const prompt = `typescript-${randomUUID()}`;

  const suggestions = [
    { description: "A course on TypeScript basics.", title: "TypeScript" },
  ];

  await prisma.courseSuggestion.upsert({
    create: { language, prompt, suggestions },
    update: { suggestions },
    where: { languagePrompt: { language, prompt } },
  });

  const result = await generateCourseSuggestions({ language, prompt });

  expect(result.suggestions).toEqual(suggestions);
  expect(result.id).toBeTypeOf("number");
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

  expect(result.suggestions).toEqual(generatedSuggestions);
  expect(result.id).toBeTypeOf("number");
  expect(spy).toHaveBeenCalledOnce();

  // check if the record was added to the database
  const record = await generateCourseSuggestions({ language, prompt });
  expect(record.suggestions).toEqual(generatedSuggestions);
  expect(record.id).toBe(result.id);
  expect(spy).toHaveBeenCalledOnce();
});

test("getCourseSuggestionById returns null for non-existent id", async () => {
  const result = await getCourseSuggestionById(999_999);
  expect(result).toBeNull();
});

test("getCourseSuggestionById returns suggestion by id", async () => {
  const language = "en";
  const prompt = `by-id-${randomUUID()}`;
  const suggestions = [
    { description: "Test description", title: "Test Course" },
  ];

  const record = await prisma.courseSuggestion.create({
    data: { language, prompt, suggestions },
  });

  const result = await getCourseSuggestionById(record.id);

  expect(result).toEqual({
    language,
    prompt,
    suggestions,
  });
});
