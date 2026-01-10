import { randomUUID } from "node:crypto";
import * as courseSuggestions from "@zoonk/ai/course-suggestions/generate";
import { prisma } from "@zoonk/db";
import { expect, test, vi } from "vitest";
import { generateCourseSuggestions } from "./course-suggestions";

test("get an existing item", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const locale = "en";
  const prompt = `typescript-${randomUUID()}`;

  const suggestions = [
    { description: "A course on TypeScript basics.", title: "TypeScript" },
  ];

  await prisma.courseSuggestion.upsert({
    create: { locale, prompt, suggestions },
    update: { suggestions },
    where: { localePrompt: { locale, prompt } },
  });

  const result = await generateCourseSuggestions({ locale, prompt });

  expect(result.suggestions).toEqual(suggestions);
  expect(result.id).toBeTypeOf("number");
  expect(spy).not.toHaveBeenCalled();
});

test("generates a new item", async () => {
  const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

  const locale = "en";
  const prompt = `vitest-${randomUUID()}`;

  const generatedSuggestions = [
    { description: "A course on Vitest basics.", title: "Vitest" },
  ];

  spy.mockResolvedValueOnce({ data: generatedSuggestions } as never);

  const result = await generateCourseSuggestions({ locale, prompt });

  expect(result.suggestions).toEqual(generatedSuggestions);
  expect(result.id).toBeTypeOf("number");
  expect(spy).toHaveBeenCalledOnce();

  // check if the record was added to the database
  const record = await generateCourseSuggestions({ locale, prompt });
  expect(record.suggestions).toEqual(generatedSuggestions);
  expect(record.id).toBe(result.id);
  expect(spy).toHaveBeenCalledOnce();
});
