import { describe, expect, it } from "vitest";
import { getDefaultChapterImage, getDefaultLessonImage } from "./default-images";

describe(getDefaultChapterImage, () => {
  it("uses the first valid course category for chapter fallback art", () => {
    const image = getDefaultChapterImage({
      categories: [{ category: "unknown" }, { category: "science" }, { category: "math" }],
    });

    expect(image).toBe("/catalog/chapters/science.webp");
  });

  it("uses general chapter fallback art when no valid category exists", () => {
    const image = getDefaultChapterImage({ categories: [{ category: "unknown" }] });

    expect(image).toBe("/catalog/chapters/general.webp");
  });
});

describe(getDefaultLessonImage, () => {
  it("uses lesson-kind fallback art", () => {
    const image = getDefaultLessonImage("quiz");

    expect(image).toBe("/catalog/lessons/quiz.webp");
  });
});
