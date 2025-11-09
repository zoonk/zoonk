import * as courseSuggestions from "@zoonk/ai/course-suggestions";
import { addCourseSuggestion } from "@zoonk/db/queries/course-suggestions";
import { describe, expect, test, vi } from "vitest";
import { fetchCourseSuggestions } from "./course-suggestions";

describe("fetchCourseSuggestions()", () => {
  test("get an existing item", async () => {
    const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

    const locale = "en";
    const prompt = "typescript";

    const suggestions = [
      { description: "A course on TypeScript basics.", title: "TypeScript" },
    ];

    await addCourseSuggestion({ locale, prompt, suggestions });

    const result = await fetchCourseSuggestions({ locale, prompt });

    expect(result).toEqual(suggestions);
    expect(spy).not.toHaveBeenCalled();
  });

  test("generates a new item", async () => {
    const spy = vi.spyOn(courseSuggestions, "generateCourseSuggestions");

    const locale = "en";
    const prompt = `vitest-${Date.now()}`;

    const generatedSuggestions = [
      { description: "A course on Vitest basics.", title: "Vitest" },
    ];

    spy.mockResolvedValueOnce({ data: generatedSuggestions } as any);

    const result = await fetchCourseSuggestions({ locale, prompt });

    expect(result).toEqual(generatedSuggestions);
    expect(spy).toHaveBeenCalledOnce();

    // check if the record was added to the database
    const record = await fetchCourseSuggestions({ locale, prompt });
    expect(record).toEqual(generatedSuggestions);
    expect(spy).toHaveBeenCalledOnce();
  });
});
