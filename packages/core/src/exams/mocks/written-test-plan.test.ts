import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { CGU } from "./_test-utils/cgu-written";
import { planOptionMock } from "./mock-option-plan";
import { listMockOptions } from "./mock-options";
import { type MockCandidate, outlineMock } from "./mock-plan";
import { outlineWrittenPrompts, planWrittenTest } from "./written-test-plan";
import { pickWrittenTestDays } from "./written-test-schedule";

const EARLIEST = "2026-11-02";
const EXAM = "2026-11-30";

function candidate(index: number): MockCandidate {
  return {
    answered: false,
    area: "Control",
    difficulty: null,
    itemFormat: "multipleChoice",
    itemId: `objective-${index}`,
    skillId: "control",
  };
}

describe("written mock options", () => {
  it("keeps the existing objective counts and clocks and names both CGU sittings before prompts exist", () => {
    const options = listMockOptions({ goalAreas: ["Control", "Writing"], structure: CGU });
    const [objective, written, full, half] = options;

    const objectiveSection = {
      kind: "objective",
      minutes: 300,
      name: "Objective test",
      questions: 170,
      session: "Morning",
    };

    const writtenSection = {
      kind: "written",
      minutes: 210,
      name: "Written test",
      questions: 2,
      session: "Afternoon",
    };

    expect(options).toHaveLength(4);

    expect(objective).toMatchObject({
      kind: "objective",
      minutes: 300,
      objectiveOnly: true,
      questions: 170,
      sections: [objectiveSection],
    });

    expect(written).toMatchObject({
      kind: "written",
      minutes: 210,
      pacing: "official",
      questions: 0,
      sections: [writtenSection],
    });

    expect(full).toMatchObject({
      kind: "full",
      minutes: 510,
      questions: 170,
      sections: [objectiveSection, writtenSection],
    });

    expect(half).toMatchObject({ kind: "half", minutes: 150, objectiveOnly: true, questions: 85 });

    const candidates = Array.from({ length: 170 }, (_, index) => candidate(index));

    const essays = [
      { itemId: "prompt-short", taskKey: "short" },
      { itemId: "prompt-long", taskKey: "long" },
    ];

    for (const option of options) {
      const plan = planOptionMock({ candidates, essays, option, structure: CGU });
      const previous = outlineMock({ fullLength: option.kind !== "half", structure: CGU });
      const expectedObjective = option.kind === "written" ? [] : previous.sections;
      const actualObjective = plan.sections.filter((section) => section.questions > 0);

      expect(actualObjective.map(({ minutes, questions }) => [questions, minutes])).toStrictEqual(
        expectedObjective.map(({ minutes, questions }) => [questions, minutes]),
      );

      expect(plan.minutes).toBe(option.minutes);
    }
  });

  it("drops an implausible saved count across the sitting's written parts", () => {
    const section = CGU.mock?.sections.find(({ kind }) => kind === "written");

    const structure: ExamStructure = {
      ...CGU,
      mock:
        (CGU.mock &&
          section && {
            ...CGU.mock,
            sections: ["First", "Second"].map((name) => ({
              ...section,
              name,
              tasks: [{ count: 13, description: name, key: name }],
            })),
          }) ||
        null,
    };

    const prompts = outlineWrittenPrompts({ day: null, structure });
    expect(prompts).toHaveLength(2);
    expect(prompts.map(({ taskKey }) => taskKey)).not.toContain("First");
  });

  it("requires one distinct prompt per slot on the chosen exam day", () => {
    const sections = CGU.mock?.sections ?? [];
    const cguWritten = sections[1]!;

    const structure: ExamStructure = {
      ...CGU,
      mock: CGU.mock && {
        ...CGU.mock,
        sections: [
          {
            ...cguWritten,
            day: 1,
            tasks: [{ count: 2, description: "Two questions", key: "short" }],
          },
          {
            ...cguWritten,
            day: 2,
            tasks: [{ count: 1, description: "Optional paper", key: "optional" }],
          },
        ],
      },
    };

    const essays = [
      { itemId: "one", taskKey: "short" },
      { itemId: "one", taskKey: "short" },
      { itemId: "other-day", taskKey: "optional" },
    ];

    expect(planWrittenTest({ day: 1, essays, structure })).toMatchObject({
      sections: [],
      written: [{ asked: false }],
    });

    expect(
      planWrittenTest({
        day: 1,
        essays: [...essays, { itemId: "two", taskKey: "short" }],
        structure,
      }),
    ).toMatchObject({
      minutes: 210,
      sections: [{ essays: ["one", "two"] }],
      written: [{ asked: true }],
    });

    expect(planWrittenTest({ day: 2, essays, structure })).toMatchObject({
      sections: [{ essays: ["other-day"] }],
      written: [{ asked: true }],
    });
  });

  it("labels a standalone shared-clock essay as practice pacing and keeps the combined paper on its shared clock", () => {
    const structure: ExamStructure = {
      ...CGU,
      mock: CGU.mock && {
        ...CGU.mock,
        sections: [
          { day: 1, kind: "objective", minutes: 330, name: "Languages and essay", questions: 90 },
          {
            day: 1,
            kind: "written",
            minutes: null,
            name: "Essay",
            questions: null,
            tasks: [{ count: 1, description: "Essay", key: "essay" }],
          },
        ],
        timeLimitMinutes: 330,
        totalQuestions: 90,
      },
    };

    const options = listMockOptions({ goalAreas: [], structure });
    expect(options.map(({ kind }) => kind)).toStrictEqual(["full", "written", "half"]);
    expect(options[0]).toMatchObject({ minutes: 330, questions: 90, written: ["Essay"] });

    expect(options[1]).toMatchObject({
      minutes: 60,
      pacing: "practice",
      sections: [{ minutes: null, questions: 1 }],
    });
  });
});

describe(pickWrittenTestDays, () => {
  it("chooses distinct feasible days near midpoint and before the exam in its final week", () => {
    expect(
      pickWrittenTestDays({
        sectionMinutes: 210,
        studyDays: [
          { date: "2026-11-29", minutes: 30 },
          { date: "2026-11-15", minutes: 200 },
          { date: "2026-11-27", minutes: 210 },
          { date: "2026-11-17", minutes: 240 },
          { date: EARLIEST, minutes: 210 },
          { date: EXAM, minutes: 480 },
        ],
        targetDate: EXAM,
      }),
    ).toStrictEqual(["2026-11-17", "2026-11-27"]);
  });

  it("leaves an infeasible or shared-clock day for practice-block scheduling", () => {
    const studyDays = [{ date: "2026-11-28", minutes: 210 }];

    expect(pickWrittenTestDays({ sectionMinutes: 210, studyDays, targetDate: EXAM })).toStrictEqual(
      ["2026-11-28"],
    );

    expect(pickWrittenTestDays({ sectionMinutes: 211, studyDays, targetDate: EXAM })).toStrictEqual(
      [],
    );

    expect(
      pickWrittenTestDays({ sectionMinutes: null, studyDays, targetDate: EXAM }),
    ).toStrictEqual([]);
  });
});
