import { describe, expect, it } from "vitest";
import { listAnnouncedQuestions } from "../../library/exams/material-formats";
import { findAnnouncedSkillIds, markAnnouncedUnits } from "./announced-lessons";
import { type QueueUnit } from "./plan-units";

const ANNOUNCEMENT =
  "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

const citation = { passage: ANNOUNCEMENT, sourceId: "notes" };

/** Pass 9's reading of Pedro's notes: each format, without what it asks about. */
const FORMATS = [
  { citation, description: "Questão de completar tabela.", kind: "shortAnswer", options: null },
  { citation, description: "Questão dissertativa.", kind: "essay", options: null },
] as const;

const SKILLS = [
  { name: "Identificar organelas de síntese e digestão", skillId: "organelles" },
  { name: "Completar tabelas de funções das organelas", skillId: "table" },
  { name: "Calcular e prever processos de transporte passivo", skillId: "passive" },
  { name: "Elaborar resposta dissertativa sobre comportamento osmótico", skillId: "essay" },
];

const LESSONS = [
  { lessonId: "osmosis", skillIds: ["passive"], title: "Conceito de osmose e gradiente" },
  { lessonId: "golgi", skillIds: ["organelles"], title: "Complexo golgiense e organelas" },
  { lessonId: "map", skillIds: ["table"], title: "Mapeamento de organelas e funções" },
].map((lesson) => ({ ...lesson, chapterId: null, minutes: 4 }));

/** One unit per lesson, and the essay skill's lessons not written yet. */
const UNITS: QueueUnit[] = [
  ...LESSONS.map((lesson) => ({
    area: "Biologia",
    chapterId: null,
    key: `lesson:${lesson.lessonId}`,
    kind: "lesson" as const,
    lessonId: lesson.lessonId,
    minutes: 4,
    phase: 0,
    skillId: lesson.skillIds[0] ?? null,
    title: lesson.title,
  })),
  {
    area: "Biologia",
    chapterId: null,
    key: "skill:essay",
    kind: "lesson",
    lessonId: null,
    lessons: 4,
    minutes: 16,
    phase: 0,
    skillId: "essay",
    title: "Elaborar resposta dissertativa sobre comportamento osmótico",
  },
];

describe("what a class test's material announces", () => {
  it("reads what each format asks about from the passage it quotes", () => {
    expect(listAnnouncedQuestions(FORMATS)).toStrictEqual([
      "Questão de completar tabela.",
      "Completar a tabela das organelas",
      "Questão dissertativa.",
      "Dissertativa sobre osmose",
    ]);
  });

  it("finds the skills practicing each announced format, whatever the reading kept", () => {
    const announcements = FORMATS.map((format) => format.description);

    expect(findAnnouncedSkillIds({ announcements, skills: SKILLS })).toStrictEqual(
      new Set(["table", "essay"]),
    );
  });

  it("finds no skill for an announcement that names no format or topic of one skill", () => {
    expect(
      findAnnouncedSkillIds({ announcements: ["Vai cair organelas"], skills: SKILLS }),
    ).toStrictEqual(new Set());
  });

  it("marks the lessons on an announced topic and every lesson practicing an announced format", () => {
    const marked = markAnnouncedUnits({
      announcements: listAnnouncedQuestions(FORMATS),
      lessons: LESSONS,
      skills: SKILLS,
      units: UNITS,
    });

    expect(marked.filter((unit) => unit.announced).map((unit) => unit.key)).toStrictEqual([
      "lesson:osmosis",
      "lesson:map",
      "skill:essay",
    ]);
  });

  // "Organelles" names lessons of two skills: it says nothing about which one the question asks.
  it("marks no lesson by a word in the titles of several skills' lessons", () => {
    const marked = markAnnouncedUnits({
      announcements: ["Vai cair organelas"],
      lessons: LESSONS,
      skills: SKILLS,
      units: UNITS,
    });

    expect(marked.filter((unit) => unit.announced)).toStrictEqual([]);
  });
});
