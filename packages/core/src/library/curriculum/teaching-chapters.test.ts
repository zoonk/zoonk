import { describe, expect, it } from "vitest";
import { keepToOneSubject } from "./teaching-chapters";

function chapter(chapterId: string, skillIds: string[] = []) {
  return { chapterId, lessons: ["Lição"], skillIds, title: `Capítulo ${chapterId}` };
}

function tag(chapterId: string, id: string, area: string) {
  return { chapterId, skill: { area, id } };
}

const scope = { exams: [{ name: "ENEM", style: "Five-option items." }] };

describe(keepToOneSubject, () => {
  it("keeps a chapter for a skill of the subject it already teaches", () => {
    const teaching = [tag("graphs", "percent", "Matemática")];

    expect(
      keepToOneSubject({
        chapters: [chapter("graphs", ["ratios"])],
        scope,
        skillAreas: { ratios: "Matemática" },
        teaching,
      }),
    ).toStrictEqual(teaching);
  });

  it("drops a chapter whose chapter or lesson tags already teach another of the exam's subjects", () => {
    expect(
      keepToOneSubject({
        chapters: [chapter("news", ["reading"])],
        scope,
        skillAreas: { reading: "Linguagens" },
        teaching: [tag("news", "charts", "Matemática")],
      }),
    ).toStrictEqual([]);
  });

  it("drops every new tag on a chapter this answer would split between two subjects", () => {
    expect(
      keepToOneSubject({
        chapters: [chapter("mixed"), chapter("ratios")],
        scope,
        teaching: [
          tag("mixed", "charts", "Matemática"),
          tag("mixed", "reading", "Linguagens"),
          tag("ratios", "percent", "Matemática"),
        ],
      }),
    ).toStrictEqual([tag("ratios", "percent", "Matemática")]);
  });

  it("leaves a goal that isn't an exam free to reuse any chapter", () => {
    const teaching = [tag("news", "charts", "Matemática")];

    expect(
      keepToOneSubject({
        chapters: [chapter("news", ["reading"])],
        scope: {},
        skillAreas: { reading: "Linguagens" },
        teaching,
      }),
    ).toStrictEqual(teaching);
  });

  it("ignores skills the exam goal doesn't plan, which have no subject of its own", () => {
    const teaching = [tag("graphs", "percent", "Matemática")];

    expect(
      keepToOneSubject({
        chapters: [chapter("graphs", ["another-exam-skill"])],
        scope,
        skillAreas: {},
        teaching,
      }),
    ).toStrictEqual(teaching);
  });
});
