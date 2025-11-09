import * as courseSuggestions from "@zoonk/ai/course-suggestions";
import { addCourseSuggestion } from "@zoonk/db/queries/course-suggestions";
import { describe, expect, test, vi } from "vitest";
import { fetchCourseSuggestions } from "./course-suggestions";

vi.mock("@zoonk/ai/course-suggestions", { spy: true });

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
});
