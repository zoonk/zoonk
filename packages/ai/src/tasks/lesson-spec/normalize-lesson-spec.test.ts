import { describe, expect, it } from "vitest";
import { type RawLessonSpec, normalizeLessonSpec } from "./normalize-lesson-spec";

type RawLessonScreen = RawLessonSpec["screens"][number];

function rawScreen(overrides: Partial<RawLessonScreen>): RawLessonScreen {
  return {
    activityTemplate: null,
    brief: "Brief",
    kind: "explanation",
    skills: [1],
    visual: null,
    ...overrides,
  };
}

function rawSpec(screens: RawLessonScreen[]): RawLessonSpec {
  return {
    canDo: " Calculate a percent change ",
    description: " What changes in percent. ",
    screens,
    skills: [
      {
        description: " The change divided by the start. ",
        example: " 80 to 100 is 25% ",
        hard: true,
        name: " Calculate a percent change ",
        topic: " ",
        useCase: " Price rises ",
      },
    ],
    supportMode: "explanationFirst",
    title: " Percent change ",
  };
}

const templateIds = new Set(["slider-graph", "number-line", "find-error"]);
const exploreIds = new Set(["slider-graph", "number-line"]);

describe(normalizeLessonSpec, () => {
  it("trims text, falls back to the skill name as its topic and computes minutes", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([
        rawScreen({ kind: "hook", skills: [] }),
        rawScreen({ kind: "explanation" }),
        rawScreen({ kind: "check" }),
        rawScreen({ kind: "application" }),
      ]),
      templateIds,
    });

    expect(spec.title).toBe("Percent change");
    expect(spec.canDo).toBe("Calculate a percent change");
    expect(spec.skills[0]?.topic).toBe("Calculate a percent change");
    expect(spec.estimatedMinutes).toBe(2);
  });

  it("takes the support mode from the screen after the hook, which the writer builds on", () => {
    const explained = normalizeLessonSpec({
      exploreIds,
      raw: {
        ...rawSpec([
          rawScreen({ kind: "hook", skills: [] }),
          rawScreen({ kind: "explanation" }),
          rawScreen({ kind: "check" }),
          rawScreen({ kind: "application" }),
        ]),
        supportMode: "questionFirst",
      },
      templateIds,
    });

    const asked = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([
        rawScreen({ kind: "hook", skills: [] }),
        rawScreen({ kind: "check" }),
        rawScreen({ kind: "explanation" }),
        rawScreen({ kind: "application" }),
      ]),
      templateIds,
    });

    expect(explained.supportMode).toBe("explanationFirst");
    expect(asked.supportMode).toBe("questionFirst");
  });

  it("turns skill numbers into indexes and drops unknown or repeated ones", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([rawScreen({ skills: [1, 1, 0, 2, 1.5] })]),
      templateIds,
    });

    expect(spec.screens[0]?.skills).toStrictEqual([0]);
  });

  it("gives a one-skill lesson's screen that names no skill that skill, but never the hook", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([
        rawScreen({ kind: "hook", skills: [] }),
        rawScreen({ kind: "check", skills: [] }),
        rawScreen({ kind: "application", skills: [7] }),
      ]),
      templateIds,
    });

    expect(spec.screens.map((screen) => screen.skills)).toStrictEqual([[], [0], [0]]);
  });

  it("writes what learners read as plain lines, without em dashes or Markdown", () => {
    const raw = rawSpec([rawScreen({ kind: "hook", skills: [] })]);
    const [skill] = raw.skills;

    const spec = normalizeLessonSpec({
      exploreIds,
      raw: {
        ...raw,
        canDo: "Calcular — e **comparar** preços",
        skills: [{ ...skill!, example: "De 80 para 100 — **25%", name: "## Calcular _juros_" }],
        title: "[Juros](https://example.com) simples",
      },
      templateIds,
    });

    expect([spec.title, spec.canDo]).toStrictEqual([
      "Juros simples",
      "Calcular, e comparar preços",
    ]);

    expect(spec.skills[0]).toMatchObject({
      example: "De 80 para 100, 25%",
      name: "Calcular juros",
      topic: "Calcular juros",
    });
  });

  it("keeps activities from the catalog and turns the others into checks", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([
        rawScreen({ activityTemplate: " slider-graph ", kind: "activity" }),
        rawScreen({ activityTemplate: "made-up-chart", kind: "activity" }),
        rawScreen({ activityTemplate: "number-line", kind: "check" }),
      ]),
      templateIds,
    });

    expect(spec.screens.map((screen) => [screen.kind, screen.activityTemplate])).toStrictEqual([
      ["activity", "slider-graph"],
      ["check", null],
      ["check", null],
    ]);
  });

  it("keeps a template on an explanation only when it can be explored", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([
        rawScreen({ activityTemplate: " number-line ", kind: "explanation" }),
        rawScreen({ activityTemplate: "find-error", kind: "explanation" }),
        rawScreen({ activityTemplate: "made-up-chart", kind: "explanation" }),
      ]),
      templateIds,
    });

    expect(spec.screens.map((screen) => [screen.kind, screen.activityTemplate])).toStrictEqual([
      ["explanation", "number-line"],
      ["explanation", null],
      ["explanation", null],
    ]);
  });

  it("stores an empty visual as no visual", () => {
    const spec = normalizeLessonSpec({
      exploreIds,
      raw: rawSpec([rawScreen({ visual: "  " }), rawScreen({ visual: " A price tag. " })]),
      templateIds,
    });

    expect(spec.screens.map((screen) => screen.visual)).toStrictEqual([null, "A price tag."]);
  });
});
