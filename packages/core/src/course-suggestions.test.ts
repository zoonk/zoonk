import { randomUUID } from "node:crypto";
import * as courseSuggestions from "@zoonk/ai/course-suggestions";
import { describe, expect, test, vi } from "vitest";
import {
  getCourseSuggestions,
  upsertCourseSuggestion,
} from "./course-suggestions";

describe("getCourseSuggestions()", () => {
  test("get an existing item", async () => {
    const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

    const locale = "en";
    const prompt = "typescript";

    const suggestions = [
      { description: "A course on TypeScript basics.", title: "TypeScript" },
    ];

    await upsertCourseSuggestion({ locale, prompt, suggestions });

    const result = await getCourseSuggestions({ locale, prompt });

    expect(result).toEqual(suggestions);
    expect(spy).not.toHaveBeenCalled();
  });

  test("generates a new item", async () => {
    const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

    const locale = "en";
    const prompt = `vitest-${randomUUID()}`;

    const generatedSuggestions = [
      { description: "A course on Vitest basics.", title: "Vitest" },
    ];

    spy.mockResolvedValueOnce({ data: generatedSuggestions } as any);

    const result = await getCourseSuggestions({ locale, prompt });

    expect(result).toEqual(generatedSuggestions);
    expect(spy).toHaveBeenCalledOnce();

    // check if the record was added to the database
    const record = await getCourseSuggestions({ locale, prompt });
    expect(record).toEqual(generatedSuggestions);
    expect(spy).toHaveBeenCalledOnce();
  });
});
