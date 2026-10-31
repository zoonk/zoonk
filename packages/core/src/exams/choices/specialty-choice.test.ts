import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { listSubjectShares } from "../../library/exams/subject-shares";
import { planOptionMock } from "../mocks/mock-option-plan";
import { listMockOptions } from "../mocks/mock-options";
import { toMockStructure } from "../mocks/mock-structure";
import reading from "./_test-utils/cgu-2026-structure.json";
import { type ExamChoice, listChoiceGroups, toChosenStructure } from "./exam-choices";

const CGU = examStructureSchema.parse(reading);
const [SPECIALTY] = listChoiceGroups(CGU.subjects);

const SOFTWARE = SPECIALTY?.options.find(
  (option) => option.shortName === "Desenvolvimento de Sistemas",
);

const PICKED: ExamChoice[] =
  SPECIALTY && SOFTWARE ? [{ group: SPECIALTY.name, subject: SOFTWARE.name }] : [];

const UNCOUNTED_SECTION: ExamStructure["mock"] = CGU.mock && {
  ...CGU.mock,
  sections: [
    {
      day: null,
      kind: "objective",
      minutes: 300,
      name: "Provas objetivas (P1, P2 e P3)",
      questions: null,
    },
  ],
};

function countFullMockByTest({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): Record<string, number> {
  const chosen = toMockStructure({
    noticeQuestions: null,
    ownerId: null,
    structure: toChosenStructure({ choices, structure }),
  });

  const areas = chosen.subjects.map((subject) => subject.name);

  const candidates = areas.flatMap((area) =>
    Array.from({ length: 100 }, (_, index) => ({
      answered: false,
      area,
      difficulty: null,
      itemFormat: "trueFalse" as const,
      itemId: `${area}#${index}`,
      skillId: `${area}-${index % 10}`,
    })),
  );

  const full = listMockOptions({ dayInTurn: null, goalAreas: areas, structure: chosen }).find(
    (option) => option.kind === "full",
  );

  if (!full) {
    throw new Error("Expected a full mock");
  }

  const tests = planOptionMock({ candidates, option: full, structure: chosen })
    .sections.flatMap((section) => section.itemIds)
    .map(
      (itemId) => chosen.subjects.find((subject) => itemId.startsWith(`${subject.name}#`))?.group,
    );

  return Object.fromEntries(
    [...Map.groupBy(tests, (test) => test ?? "none")].map(([test, items]) => [test, items.length]),
  );
}

describe("a CGU 2026 specialty, as its notice was read", () => {
  const whole = {
    "Conhecimentos básicos (P1)": 40,
    "Conhecimentos complementares (P2)": 40,
    "Conhecimentos específicos (P3)": 90,
  };

  it("makes a full mock the whole 170-question exam, with the picked specialty as P3", () => {
    expect(countFullMockByTest({ choices: PICKED, structure: CGU })).toStrictEqual(whole);
  });

  it("sizes a full mock the same when the reading lists the objective tests without a count", () => {
    const structure = { ...CGU, mock: UNCOUNTED_SECTION };
    expect(countFullMockByTest({ choices: PICKED, structure })).toStrictEqual(whole);
  });

  it("asks only the shared tests before the learner picks", () => {
    expect(countFullMockByTest({ choices: [], structure: CGU })).toStrictEqual({
      "Conhecimentos básicos (P1)": 40,
      "Conhecimentos complementares (P2)": 40,
    });
  });

  it("weighs the picked specialty by the final score's formula: half for the 260 objective points, 180 of them P3's", () => {
    const chosen = toChosenStructure({ choices: PICKED, structure: CGU });
    const shares = listSubjectShares(chosen);

    const shareOf = (name?: string) =>
      shares[chosen.subjects.findIndex((item) => item.name === name)];

    expect(shareOf(SOFTWARE?.name)).toBeCloseTo((0.5 * 180) / 260);
    expect(shareOf("Prova discursiva")).toBe(0.5);
    expect(shares.reduce<number>((sum, share) => sum + (share ?? 0), 0)).toBeCloseTo(1);
  });

  it("weighs the picked specialty by P3's 180 of the exam's 360 points without a formula", () => {
    const scoring = CGU.mock && { ...CGU.mock.scoring, finalShares: undefined };
    const structure = { ...CGU, mock: CGU.mock && scoring && { ...CGU.mock, scoring } };
    const chosen = toChosenStructure({ choices: PICKED, structure });
    const index = chosen.subjects.findIndex((subject) => subject.name === SOFTWARE?.name);

    expect(listSubjectShares(chosen)[index]).toBe(0.5);
  });
});
