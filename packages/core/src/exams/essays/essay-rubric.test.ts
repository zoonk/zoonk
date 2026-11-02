import { describe, expect, it } from "vitest";
import { getEssayRubric } from "./essay-rubric";

const criteria = [{ criterion: "Argument", description: "Defends a clear position", points: null }];
const custom = [{ criterion: "Argument", description: "Defends a clear position" }];

const apCriteria = [
  { criterion: "Thesis", description: "Makes a defensible claim", points: 1 },
  { criterion: "Evidence", description: "Supports it with specific evidence", points: 2 },
];

const apExam = { identityKey: "ap-us-history", name: "AP United States History" };

describe(getEssayRubric, () => {
  it("uses the official rubric for ENEM and OAB", () => {
    expect(
      getEssayRubric({ blueprint: { identityKey: "enem", name: "ENEM" }, criteria }),
    ).toStrictEqual({ kind: "enem" });

    expect(
      getEssayRubric({
        blueprint: { identityKey: "oab-exame-de-ordem", name: "Exame da OAB" },
        criteria,
      }),
    ).toStrictEqual({ kind: "oab" });
  });

  it("scores an AP question by its rows' own points", () => {
    expect(getEssayRubric({ blueprint: apExam, criteria: apCriteria })).toStrictEqual({
      criteria: apCriteria,
      kind: "ap",
    });
  });

  it("uses the item's criteria for other exams and for rows without points", () => {
    expect(
      getEssayRubric({ blueprint: { identityKey: "inss-tecnico", name: "INSS" }, criteria }),
    ).toStrictEqual({ criteria: custom, kind: "custom", maxScore: 10 });

    expect(getEssayRubric({ blueprint: apExam, criteria })).toMatchObject({ kind: "custom" });

    expect(getEssayRubric({ blueprint: null, criteria: apCriteria })).toMatchObject({
      kind: "custom",
    });
  });
});
