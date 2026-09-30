import { describe, expect, it } from "vitest";
import { type RawCourseOutline, normalizeCourseOutline } from "./normalize-course-outline";

type RawChapter = RawCourseOutline["chapters"][number];
type RawLesson = RawChapter["lessons"][number];

function rawLesson(overrides: Partial<RawLesson> = {}): RawLesson {
  return {
    canDo: " Calculate a discount ",
    description: " Percent off a price. ",
    estimatedMinutes: 3,
    skills: ["Calculate a percentage"],
    title: " Percentages ",
    ...overrides,
  };
}

function rawChapter(overrides: Partial<RawChapter> = {}): RawChapter {
  return {
    description: " Parts of a whole. ",
    lessons: [rawLesson()],
    objectives: [" Compare prices ", ""],
    skillKeys: [],
    title: " Fractions and percentages ",
    tools: [],
    ...overrides,
  };
}

describe(normalizeCourseOutline, () => {
  it("trims text and drops empty objectives, lessons and chapters", () => {
    const outline = normalizeCourseOutline({
      level: "beginner",
      raw: {
        chapters: [
          rawChapter({ lessons: [rawLesson(), rawLesson({ title: "  " })] }),
          rawChapter({ lessons: [rawLesson({ title: "" })], title: "Only empty lessons" }),
          rawChapter({ title: " " }),
        ],
      },
      requiredSkillKeys: [],
    });

    expect(outline).toStrictEqual({
      chapters: [
        {
          description: "Parts of a whole.",
          lessons: [
            {
              canDo: "Calculate a discount",
              description: "Percent off a price.",
              estimatedMinutes: 3,
              skills: ["Calculate a percentage"],
              title: "Percentages",
            },
          ],
          objectives: ["Compare prices"],
          skillKeys: [],
          title: "Fractions and percentages",
          tools: [],
        },
      ],
      uncoveredSkillKeys: [],
    });
  });

  it("keeps one entry per tool, essential when any of its entries is", () => {
    const outline = normalizeCourseOutline({
      level: "beginner",
      raw: {
        chapters: [
          rawChapter({
            tools: [
              { essential: false, name: " Spreadsheet (Google Sheets or Excel) " },
              { essential: false, name: "Python" },
              { essential: true, name: "spreadsheet (google sheets or excel)" },
              { essential: true, name: "  " },
              { essential: false, name: "A terminal" },
              { essential: false, name: "A code editor (VS Code)" },
              { essential: false, name: "R" },
            ],
          }),
        ],
      },
      requiredSkillKeys: [],
    });

    expect(outline.chapters[0]?.tools).toStrictEqual([
      { essential: true, name: "Spreadsheet (Google Sheets or Excel)" },
      { essential: false, name: "Python" },
      { essential: false, name: "A terminal" },
      { essential: false, name: "A code editor (VS Code)" },
    ]);
  });

  it("keeps lesson minutes inside the lesson size rules", () => {
    const outline = normalizeCourseOutline({
      level: "advanced",
      raw: {
        chapters: [
          rawChapter({
            lessons: [
              rawLesson({ estimatedMinutes: 1 }),
              rawLesson({ estimatedMinutes: 9 }),
              rawLesson({ estimatedMinutes: 9, skills: ["Derive a formula", "Apply it"] }),
              rawLesson({ estimatedMinutes: 3.6 }),
            ],
          }),
        ],
      },
      requiredSkillKeys: [],
    });

    expect(outline.chapters[0]?.lessons.map((lesson) => lesson.estimatedMinutes)).toStrictEqual([
      2, 6, 5, 4,
    ]);
  });

  it("removes repeated skills that only differ in case or accents", () => {
    const outline = normalizeCourseOutline({
      level: "beginner",
      raw: {
        chapters: [
          rawChapter({
            lessons: [
              rawLesson({ skills: ["Calcular média", " calcular media", "", "Ler um gráfico"] }),
            ],
          }),
        ],
      },
      requiredSkillKeys: [],
    });

    expect(outline.chapters[0]?.lessons[0]?.skills).toStrictEqual([
      "Calcular média",
      "Ler um gráfico",
    ]);
  });

  it("keeps only required skill keys and reports required skills no chapter teaches", () => {
    const outline = normalizeCourseOutline({
      level: "beginner",
      raw: {
        chapters: [
          rawChapter({ skillKeys: ["fractions", "invented", "fractions"] }),
          rawChapter({ skillKeys: ["equations"], title: "Linear equations" }),
        ],
      },
      requiredSkillKeys: ["fractions", "equations", "vectors"],
    });

    expect(outline.chapters.map((chapter) => chapter.skillKeys)).toStrictEqual([
      ["fractions"],
      ["equations"],
    ]);

    expect(outline.uncoveredSkillKeys).toStrictEqual(["vectors"]);
  });
});
