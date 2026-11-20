import { describe, expect, it } from "vitest";
import { toCatalogCourse } from "./catalog-responses";
import { courseResultSchema } from "./openapi/schemas/courses";

describe(toCatalogCourse, () => {
  it("gives a catalog card the line its course page leads with", () => {
    const card = toCatalogCourse({
      categories: [],
      description: "Academic reading is the practice of reading scholarly texts.",
      estimatedMinutes: 30,
      id: crypto.randomUUID(),
      imageUrl: null,
      language: "en",
      lessonCount: 3,
      organization: { id: crypto.randomUUID(), logo: null, name: "Zoonk", slug: "zoonk" },
      promise: "Read academic articles without losing the point.",
      slug: "academic-reading",
      targetLanguage: null,
      title: "Academic Reading",
    });

    expect(courseResultSchema.parse(card).promise).toBe(
      "Read academic articles without losing the point.",
    );
  });
});
