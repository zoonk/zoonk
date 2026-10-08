import { describe, expect, it } from "vitest";
import { normalizePlanEdit } from "./normalize-plan-edit";

const input = {
  areas: ["Mathematics", "Natural sciences", "Língua Portuguesa"],
  goalKind: "exam",
  today: "2026-09-28",
};

function change(attrs: Partial<Parameters<typeof normalizePlanEdit>[0]["raw"]["changes"][number]>) {
  return {
    activities: null,
    areas: null,
    bias: null,
    date: null,
    kind: "setDailyMinutes",
    minutes: null,
    start: null,
    weekdays: null,
    ...attrs,
  };
}

describe(normalizePlanEdit, () => {
  it("narrows a focus to the part of an area the learner named, with that area's skills only", () => {
    const skills = [
      { area: "Natural sciences", name: "Explain heredity", skillId: "genetics" },
      { area: "Natural sciences", name: "Explain circuits", skillId: "circuits" },
      { area: "Natural sciences", name: "Name organic functions", skillId: "organic" },
      { area: "Mathematics", name: "Calculate percentages", skillId: "percentages" },
    ];

    const result = normalizePlanEdit({
      input: { ...input, skills },
      raw: {
        changes: [
          change({
            areas: ["Natural sciences"],
            kind: "focusAreas",
            parts: [
              {
                area: "natural sciences",
                name: " biology and chemistry ",
                skills: ["K1", "K3", "K4", "K9"],
              },
              { area: "History", name: "Brazil", skills: ["K2"] },
            ],
          }),
        ],
        summary: "Biology and chemistry get more time.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      {
        areas: ["Natural sciences"],
        kind: "focusAreas",
        parts: [
          {
            area: "Natural sciences",
            name: "Biology and chemistry",
            skillIds: ["genetics", "organic"],
          },
        ],
      },
    ]);
  });

  it("joins the parts the model split within one area, since a plan keeps one part per area", () => {
    const skills = [
      { area: "Natural sciences", name: "Explain heredity", skillId: "genetics" },
      { area: "Natural sciences", name: "Explain circuits", skillId: "circuits" },
      { area: "Natural sciences", name: "Name organic functions", skillId: "organic" },
    ];

    const result = normalizePlanEdit({
      input: { ...input, language: "pt", skills },
      raw: {
        changes: [
          change({
            areas: ["Natural sciences"],
            kind: "focusAreas",
            parts: [
              { area: "Natural sciences", name: "Biologia", skills: ["K1"] },
              { area: "Natural sciences", name: "Química", skills: ["K3", "K1"] },
            ],
          }),
        ],
        summary: "Mais biologia e química.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      {
        areas: ["Natural sciences"],
        kind: "focusAreas",
        parts: [
          {
            area: "Natural sciences",
            name: "Biologia e Química",
            skillIds: ["genetics", "organic"],
          },
        ],
      },
    ]);
  });

  it("never focuses an area the learner wants less of: it gets less time instead", () => {
    // "mais Processo Civil e menos Filosofia": a model that also put Filosofia in the focus would
    // give it more time, the opposite of what the learner asked.
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ areas: ["Mathematics", "Natural sciences"], kind: "focusAreas" }),
          change({ areas: ["natural sciences", "History"], kind: "reduceAreas" }),
        ],
        summary: "More math, less science.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      { areas: ["Mathematics"], kind: "focusAreas", parts: [] },
      { areas: ["Natural sciences"], kind: "reduceAreas" },
    ]);
  });

  it("drops a focus left with no area once the ones the learner wants less of are out", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ areas: ["Natural sciences"], kind: "focusAreas" }),
          change({ areas: ["Natural sciences"], kind: "reduceAreas" }),
        ],
        summary: "Less science.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([{ areas: ["Natural sciences"], kind: "reduceAreas" }]);
  });

  it("keeps a focus on part of an area over less time for the whole area", () => {
    // "mais biologia e química, física pode ser menos": the part's focus already gives the rest of
    // the area less, and less time for the whole area would take biology and chemistry with it.
    const skills = [
      { area: "Natural sciences", name: "Explain heredity", skillId: "genetics" },
      { area: "Natural sciences", name: "Explain circuits", skillId: "circuits" },
    ];

    const result = normalizePlanEdit({
      input: { ...input, skills },
      raw: {
        changes: [
          change({
            areas: ["Natural sciences"],
            kind: "focusAreas",
            parts: [{ area: "Natural sciences", name: "biology", skills: ["K1"] }],
          }),
          change({ areas: ["Natural sciences"], kind: "reduceAreas" }),
        ],
        summary: "More biology, less physics.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      {
        areas: ["Natural sciences"],
        kind: "focusAreas",
        parts: [{ area: "Natural sciences", name: "Biology", skillIds: ["genetics"] }],
      },
    ]);
  });

  it("starts the areas the plan has past their basics, or from them again", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ areas: ["mathematics", "History"], kind: "setAreaStart", start: "pastBasics" }),
          change({ areas: ["Natural sciences"], kind: "setAreaStart", start: "basics" }),
          change({ areas: ["Língua Portuguesa"], kind: "setAreaStart", start: "advanced" }),
          change({ areas: ["History"], kind: "setAreaStart", start: "pastBasics" }),
        ],
        summary: "Math starts past the basics.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      { areas: ["Mathematics"], kind: "setAreaStart", start: "pastBasics" },
      { areas: ["Natural sciences"], kind: "setAreaStart", start: "basics" },
    ]);
  });

  it("leaves language practice out only in a language plan", () => {
    const raw = {
      changes: [
        change({ activities: ["writing", "writing", "grammar"], kind: "skipActivities" }),
        change({ activities: ["listening"], kind: "restoreActivities" }),
      ],
      summary: "No more writing.",
      understood: true,
    };

    expect(
      normalizePlanEdit({ input: { ...input, goalKind: "language" }, raw }).operations,
    ).toStrictEqual([
      { activities: ["writing"], kind: "skipActivities" },
      { activities: ["listening"], kind: "restoreActivities" },
    ]);

    expect(normalizePlanEdit({ input, raw }).understood).toBe(false);
  });

  it("keeps valid changes and matches areas by case and accents", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ kind: "setWeekdayMinutes", minutes: 20.4, weekdays: [6, 0, 0, 9] }),
          change({ areas: ["mathematics", "lingua portuguesa", "History"], kind: "focusAreas" }),
          change({ bias: "morePractice", kind: "setPracticeBias" }),
        ],
        summary: " Weekends go down to 20 minutes. ",
        understood: true,
      },
    });

    expect(result).toStrictEqual({
      leftOut: [],
      operations: [
        { kind: "setWeekdayMinutes", minutes: 20, weekdays: [0, 6] },
        { areas: ["Mathematics", "Língua Portuguesa"], kind: "focusAreas", parts: [] },
        { bias: "morePractice", kind: "setPracticeBias" },
      ],
      summary: "Weekends go down to 20 minutes.",
      understood: true,
    });
  });

  it("drops changes the planner can't apply", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ date: "2026-09-01", kind: "setTargetDate" }),
          change({ date: "2026-02-30", kind: "addLightWeek" }),
          change({ areas: ["History"], kind: "skipAreas" }),
          change({ bias: "harder", kind: "setPracticeBias" }),
          change({ kind: "setWeekdayMinutes", minutes: 30, weekdays: [] }),
        ],
        summary: "Something changed.",
        understood: true,
      },
    });

    expect(result).toStrictEqual({ leftOut: [], operations: [], summary: "", understood: false });
  });

  it("keeps the parts of the request no change covers, so the buddy answers them too", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [change({ areas: ["Natural sciences"], kind: "focusAreas" })],
        leftOut: ["  mirar 800 pontos ", "", "mirar 800 pontos", "x".repeat(300)],
        summary: "Ciências da Natureza vem primeiro.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      { areas: ["Natural sciences"], kind: "focusAreas", parts: [] },
    ]);

    expect(result.leftOut).toStrictEqual(["mirar 800 pontos", `${"x".repeat(119)}…`]);
  });

  it("clamps minutes, turns a cleared date into no date and keeps a light week from today", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ kind: "setDailyMinutes", minutes: 600 }),
          change({ kind: "clearTargetDate" }),
          change({ date: "2026-09-28", kind: "addLightWeek" }),
        ],
        summary: "Done.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      { kind: "setDailyMinutes", minutes: 240 },
      { kind: "setTargetDate", targetDate: null },
      { kind: "addLightWeek", startDate: "2026-09-28" },
    ]);
  });

  it("spaces out written practice only for a plan with written tests, and its end only with a date", () => {
    const raw = {
      changes: [
        change({ cadence: "finalWeeks", kind: "setWrittenCadence" }),
        change({ cadence: "biweekly", kind: "setWrittenCadence" }),
        change({ cadence: "monthly", kind: "setWrittenCadence" }),
      ],
      summary: "Redação só nas semanas finais.",
      understood: true,
    };

    const dated = normalizePlanEdit({
      input: { ...input, targetDate: "2026-11-08", writtenParts: ["Redação"] },
      raw,
    });

    const undated = normalizePlanEdit({
      input: { ...input, targetDate: null, writtenParts: ["Redação"] },
      raw,
    });

    const withoutWriting = normalizePlanEdit({
      input: { ...input, targetDate: "2026-11-08", writtenParts: [] },
      raw,
    });

    expect(dated.operations).toStrictEqual([
      { cadence: "finalWeeks", kind: "setWrittenCadence" },
      { cadence: "biweekly", kind: "setWrittenCadence" },
    ]);

    expect(undated.operations).toStrictEqual([{ cadence: "biweekly", kind: "setWrittenCadence" }]);
    expect(withoutWriting).toMatchObject({ operations: [], understood: false });
  });

  it("writes the summary's HTML entities as the letters they stand for", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [change({ kind: "setDailyMinutes", minutes: 30 })],
        summary: "Matem&aacute;tica vem primeiro a partir de agora.",
        understood: true,
      },
    });

    expect(result.summary).toBe("Matemática vem primeiro a partir de agora.");
  });

  it("returns nothing when the model says the request isn't a plan change", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [change({ minutes: 30 })],
        leftOut: ["what is a fraction"],
        summary: "x",
        understood: false,
      },
    });

    expect(result).toStrictEqual({ leftOut: [], operations: [], summary: "", understood: false });
  });

  it("adds the topics the learner asked for, each under an area the plan has or none", () => {
    const result = normalizePlanEdit({
      input: { ...input, areas: ["Inglês"], goalKind: "language" },
      raw: {
        changes: [
          change({
            kind: "addTopics",
            topics: [
              {
                area: "inglês",
                description: " Explicar uma consulta SQL a um entrevistador. ",
                name: " Explicar consultas SQL em entrevistas ",
              },
              {
                area: "Dados",
                description: "Apresentar um painel.",
                name: "Apresentar dashboards",
              },
              { area: null, description: "Sem nome.", name: "  " },
            ],
          }),
        ],
        summary: "SQL e dashboards entram no plano.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      {
        kind: "addTopics",
        topics: [
          {
            area: "Inglês",
            description: "Explicar uma consulta SQL a um entrevistador.",
            name: "Explicar consultas SQL em entrevistas",
          },
          { area: null, description: "Apresentar um painel.", name: "Apresentar dashboards" },
        ],
      },
    ]);
  });

  it("never adds topics while fitting a new plan to the learner's routine", () => {
    const result = normalizePlanEdit({
      input: { ...input, purpose: "routine" },
      raw: {
        changes: [
          change({
            kind: "addTopics",
            topics: [{ area: null, description: "Estatística.", name: "Calcular médias" }],
          }),
        ],
        summary: "",
        understood: true,
      },
    });

    expect(result).toMatchObject({ operations: [], understood: false });
  });
});
