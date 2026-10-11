import { describe, expect, it } from "vitest";
import { toIsoDate } from "../../planner/plan-calendar";
import { checkCardMatchesPlan } from "./change-truth-rules";
import {
  ruleChange,
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleLesson,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Civil", skillId: "civil", topics: ["Contratos"] }),
  ruleSkill({ area: "Penal", skillId: "penal", topics: ["Crimes"] }),
  ruleSkill({ area: "Penal", skillId: "evolucao", topics: ["Origem e evolução"] }),
];

const before = rulePlan({
  items: [
    ruleLesson({ day: 0, lessonId: "civil-1", skillId: "civil" }),
    ruleLesson({ day: 1, lessonId: "penal-1", skillId: "penal" }),
    ruleLesson({ day: 2, lessonId: "penal-2", skillId: "penal", titleSnapshot: "Penal 2" }),
  ],
  skills,
});

const after = rulePlan({
  items: [
    ruleLesson({ day: 0, lessonId: "civil-1", skillId: "civil" }),
    ruleLesson({ day: 1, lessonId: "civil-2", skillId: "civil" }),
    ruleLesson({ day: 2, lessonId: "penal-1", skillId: "penal" }),
  ],
  skills,
});

/** A plan whose `shared` lesson, which both Penal skills teach, is filed under `skillId`. */
function filed(skillId: string) {
  return rulePlan({
    items: [
      ruleLesson({ day: 0, lessonId: "penal-1", skillId: "penal" }),
      ruleLesson({ day: 1, lessonId: "shared", skillId }),
      ruleLesson({ day: 2, lessonId: "evolucao-1", skillId: "evolucao" }),
    ],
    skills,
  });
}

const event = ruleChangeEvent({ areas: ["Civil"], kind: "focusAreas" });

const day = (offset: number) => toIsoDate(ruleDay(offset));

describe("R3 a card says what the change did to the saved plan", () => {
  it("reads a lesson set aside for time as left out, with the topic only it taught (Câmara seed 1003)", () => {
    const setAside = rulePlan({
      items: [
        ruleLesson({ day: 0, lessonId: "civil-1", skillId: "civil" }),
        ruleLesson({ day: null, lessonId: "penal-1", skillId: "penal", status: "skipped" }),
      ],
      skills,
    });

    const was = rulePlan({ items: before.items.slice(0, 2), skills });

    const card = ruleChange({
      effect: {
        lessonsLeftOut: ["penal lesson"],
        lessonsRemoved: 1,
        topicsLeftOut: [{ area: "Penal", topics: ["Crimes"] }],
      },
    });

    expect(
      checkCardMatchesPlan(
        ruleContext({
          after: setAside,
          before: was,
          changes: [card],
          event: ruleChangeEvent({ kind: "setDailyMinutes", minutes: 15 }),
        }),
      ),
    ).toStrictEqual([]);
  });

  it("compares skills as topics when the graph maps no topics (a career, a language)", () => {
    const careerSkills = [
      ruleSkill({ area: "Research", name: "Interviews", skillId: "interviews" }),
      ruleSkill({ area: "Research", name: "Surveys", skillId: "surveys" }),
    ];

    const was = rulePlan({
      items: [
        ruleLesson({ day: 0, lessonId: "interviews-1", skillId: "interviews" }),
        ruleLesson({
          day: 1,
          lessonId: "surveys-1",
          skillId: "surveys",
          titleSnapshot: "Surveys 1",
        }),
      ],
      skills: careerSkills,
    });

    const now = rulePlan({
      items: [ruleLesson({ day: 0, lessonId: "interviews-1", skillId: "interviews" })],
      skills: careerSkills,
    });

    const reduce = ruleChangeEvent({ areas: ["Research"], kind: "reduceAreas" });

    const fieldsOf = (topicsLeftOut: { area: string; topics: string[] }[]) => {
      const card = ruleChange({
        effect: { lessonsLeftOut: ["Surveys 1"], lessonsRemoved: 1, topicsLeftOut },
      });

      return checkCardMatchesPlan(
        ruleContext({ after: now, before: was, changes: [card], event: reduce }),
      ).map((violation) => violation.details?.field);
    };

    expect(fieldsOf([{ area: "Research", topics: ["Surveys"] }])).not.toContain("topicsLeftOut");
    expect(fieldsOf([])).toContain("topicsLeftOut");
  });

  it("counts a lesson both plans hold under the skill the learner saw it under (Câmara seed 2009)", () => {
    // `shared` teaches both Penal skills: the new plan files it under `evolucao`, but it's the
    // same lesson, neither added nor left out.
    expect(
      checkCardMatchesPlan(
        ruleContext({
          after: filed("evolucao"),
          before: filed("penal"),
          changes: [ruleChange({ effect: {} })],
          event: ruleChangeEvent({ kind: "setDailyMinutes", minutes: 15 }),
        }),
      ),
    ).toStrictEqual([]);
  });

  it("passes when every claim matches the plans before and after", () => {
    const change = ruleChange({
      effect: {
        areaEnds: [{ after: day(1), area: "Civil", before: day(0) }],
        areaLessons: [{ after: 1, area: "Penal", before: 2 }],
        areaStarts: [{ after: day(0), area: "Civil", before: day(0) }],
        lessonsAdded: 1,
        lessonsLeftOut: ["Penal 2"],
        lessonsRemoved: 1,
      },
    });

    expect(
      checkCardMatchesPlan(ruleContext({ after, before, changes: [change], event })),
    ).toStrictEqual([]);
  });

  it("flags counts, names, topics and an unnamed area's lessons the saved plan doesn't show", () => {
    const change = ruleChange({
      effect: {
        areaLessons: [{ after: 3, area: "Penal", before: 2 }],
        lessonsAdded: 5,
        lessonsRemoved: 1,
        topicsLeftOut: [{ area: "Penal", topics: ["Origem e evolução"] }],
      },
    });

    const fields = checkCardMatchesPlan(
      ruleContext({ after, before, changes: [change], event }),
    ).map((violation) => violation.details?.field);

    expect(fields).toStrictEqual([
      "lessonsAdded",
      "lessonsLeftOut",
      "topicsLeftOut",
      "areaEnds:Civil",
      "areaLessons:Penal",
    ]);
  });
});
