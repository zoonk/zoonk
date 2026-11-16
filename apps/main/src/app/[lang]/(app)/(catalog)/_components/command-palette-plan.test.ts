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

function catalogCourse(id: string, title: string) {
  return {
    brandSlug: "zoonk",
    description: null,
    id,
    imageUrl: null,
    language: "pt",
    slug: id,
    targetLanguage: null,
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

  it("lists a course the plan teaches once, as the learner's subject", () => {
    const quantum = {
      key: "q",
      name: "Quantum physics from scratch",
      shortName: "Quantum physics",
    };

    const results = toPaletteSearchResults({
      catalog: {
        chapters: [],
        courses: [
          catalogCourse("quantum", "Quantum Physics from Scratch"),
          catalogCourse("o", "Quantum optics"),
        ],
      },
      plan: { ...plan, subjects: [quantum] },
      query: "quantum",
    });

    expect(results.plan.subjects.map((subject) => subject.key)).toStrictEqual(["q"]);
    expect(results.catalog.courses.map((course) => course.id)).toStrictEqual(["o"]);
  });

  it("never relists a plan chapter in the catalog, even one past the plan's shown rows", () => {
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      chapterId: `p${index}`,
      subject: "Matemática",
      title: `Funções ${index}`,
      unit: false,
    }));

    const results = toPaletteSearchResults({
      catalog: { chapters: [catalogChapter("p7", "Funções 7")], courses: [] },
      plan: { ...plan, chapters },
      query: "funções",
    });

    expect(results.plan.chapters).toHaveLength(6);
    expect(results.catalog.chapters).toStrictEqual([]);
  });

  it("names a chapter's course or subject on its row only when the rows need it to tell them apart", () => {
    const shared = toPaletteSearchResults({
      catalog: {
        chapters: [
          catalogChapter("c8", "Funções afins"),
          catalogChapter("c9", "Funções orgânicas"),
        ],
        courses: [catalogCourse("enem", "ENEM")],
      },
      plan,
      query: "",
    });

    expect(shared.catalog.showsCourse).toBe(false);
    expect(shared.plan.showsSubject).toBe(false);

    const unnamed = toPaletteSearchResults({
      catalog: { chapters: [catalogChapter("c8", "Funções afins")], courses: [] },
      plan: { ...plan, subjects: [] },
      query: "funções",
    });

    expect(unnamed.catalog.showsCourse).toBe(true);
    expect(unnamed.plan.showsSubject).toBe(true);

    const mixed = toPaletteSearchResults({
      catalog: {
        chapters: [
          catalogChapter("c8", "Funções afins"),
          { ...catalogChapter("c9", "Funções orgânicas"), courseTitle: "Química" },
        ],
        courses: [catalogCourse("enem", "ENEM")],
      },
      plan: {
        ...plan,
        chapters: [
          ...plan.chapters,
          { chapterId: "c3", subject: "Física", title: "Funções", unit: false },
        ],
      },
      query: "",
    });

    expect(mixed.catalog.showsCourse).toBe(true);
    expect(mixed.plan.showsSubject).toBe(true);
  });
});
