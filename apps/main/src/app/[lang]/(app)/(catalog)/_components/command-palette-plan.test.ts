import { describe, expect, it } from "vitest";
import { toPaletteSearchResults } from "./command-palette-plan";

const plan = {
  chapters: [
    { chapterId: "c1", subject: "Matemática", title: "Funções", unit: false },
    { chapterId: "c2", subject: "Matemática", title: "Geometria", unit: false },
  ],
  mocks: [{ blockId: "b1", number: 1 }],
  subjects: [{ key: "math", name: "Matemática e suas Tecnologias", shortName: "Matemática" }],
};

function catalogChapter(id: string, title: string) {
  return {
    brandSlug: "zoonk",
    courseId: "enem",
    courseSlug: "enem",
    courseTitle: "ENEM",
    description: "",
    id,
    language: "pt",
    slug: id,
    title,
  };
}

describe(toPaletteSearchResults, () => {
  it("matches the plan without accents and lists a catalog chapter in it only as the learner's", () => {
    const catalog = {
      chapters: [catalogChapter("c1", "Funções"), catalogChapter("c9", "Funções orgânicas")],
      courses: [],
    };

    const results = toPaletteSearchResults({ catalog, plan, query: "funcoes" });

    expect(results.plan.chapters.map((chapter) => chapter.chapterId)).toStrictEqual(["c1"]);
    expect(results.catalog.chapters.map((chapter) => chapter.id)).toStrictEqual(["c9"]);
    expect(results.plan.subjects).toStrictEqual([]);
    expect(results.mocks).toStrictEqual(plan.mocks);
  });

  it("matches a subject by its full or short name", () => {
    const results = toPaletteSearchResults({
      catalog: { chapters: [], courses: [] },
      plan,
      query: "tecnologias",
    });

    expect(results.plan.subjects.map((subject) => subject.key)).toStrictEqual(["math"]);
  });
});
