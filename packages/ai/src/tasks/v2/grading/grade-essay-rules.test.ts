import { describe, expect, it } from "vitest";
import { type EssayModelOutput, type EssayRubric } from "./grade-essay";
import { findEssayQuote } from "./grade-essay-quote";
import {
  buildEssayGrade,
  buildTooShortEssayGrade,
  getEssayCriteria,
  isEssayTooShort,
} from "./grade-essay-rules";

const ENEM: EssayRubric = { kind: "enem" };
const OAB: EssayRubric = { kind: "oab" };

const ESSAY = `A desinformação sobre vacinas cresce no Brasil.
Portanto, o Ministério da Saúde deve combater a desinformação vacinal, a fim de ampliar a cobertura.`;

const ALL_ELEMENTS = { action: true, agent: true, detail: true, effect: true, means: true };

function criterion(score: number, overrides: Partial<EssayModelOutput["criteria"][string]> = {}) {
  return {
    comment: `Comment for ${score}.`,
    example: "Um exemplo melhor.",
    nextStep: `Next step for ${score}.`,
    quote: null,
    score,
    ...overrides,
  };
}

function enemOutput(
  scores: [number, number, number, number, number],
  overrides: Partial<EssayModelOutput> = {},
): EssayModelOutput {
  return {
    criteria: Object.fromEntries(scores.map((score, index) => [`c${index + 1}`, criterion(score)])),
    interventionElements: ALL_ELEMENTS,
    zeroReason: null,
    ...overrides,
  };
}

function words(count: number): string {
  return Array.from({ length: count }, () => "palavra").join(" ");
}

describe(getEssayCriteria, () => {
  it("uses the five ENEM competencies worth 200 each", () => {
    const criteria = getEssayCriteria(ENEM);

    expect(criteria.map((item) => item.id)).toStrictEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(criteria.every((item) => item.maxScore === 200)).toBe(true);
  });

  it("uses fixed OAB sections that add up to 5 points", () => {
    const criteria = getEssayCriteria(OAB);
    const total = criteria.reduce((sum, item) => sum + item.maxScore, 0);

    expect(criteria.map((item) => item.id)).toStrictEqual([
      "addressing-and-parties",
      "facts",
      "legal-basis",
      "requests",
      "closing-and-form",
    ]);

    expect(total).toBeCloseTo(5);
  });

  it("splits a custom maximum so the criteria add up to it exactly", () => {
    const criteria = getEssayCriteria({
      criteria: [
        { criterion: "Thesis", description: "A clear position" },
        { criterion: "Evidence", description: "Specific support" },
        { criterion: "Style", description: "Precise language" },
      ],
      kind: "custom",
      maxScore: 10,
    });

    expect(criteria).toStrictEqual([
      { description: "A clear position", id: "criterion-1", maxScore: 3.34, name: "Thesis" },
      { description: "Specific support", id: "criterion-2", maxScore: 3.33, name: "Evidence" },
      { description: "Precise language", id: "criterion-3", maxScore: 3.33, name: "Style" },
    ]);
  });

  it("rejects a custom rubric without criteria", () => {
    expect(() => getEssayCriteria({ criteria: [], kind: "custom", maxScore: 10 })).toThrow(
      "at least one criterion",
    );
  });
});

describe(isEssayTooShort, () => {
  it("treats ENEM texts under 60 words as too short, like 7 handwritten lines", () => {
    expect(isEssayTooShort({ essay: words(59), rubric: ENEM })).toBe(true);
    expect(isEssayTooShort({ essay: words(60), rubric: ENEM })).toBe(false);
  });

  it("only skips near-empty answers for other rubrics", () => {
    expect(isEssayTooShort({ essay: words(19), rubric: OAB })).toBe(true);
    expect(isEssayTooShort({ essay: words(20), rubric: OAB })).toBe(false);
  });

  it("doesn't count punctuation as words", () => {
    expect(isEssayTooShort({ essay: `${words(59)} — ...`, rubric: ENEM })).toBe(true);
  });
});

describe(buildEssayGrade, () => {
  it("snaps ENEM scores to steps of 40 inside 0 to 200 and sums the total in code", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([150, 130, 230, -10, Number.NaN]),
      rubric: ENEM,
    });

    expect(grade.criteria.map((item) => item.score)).toStrictEqual([160, 120, 200, 0, 0]);
    expect(grade.total).toStrictEqual({ maxScore: 1000, score: 480 });
  });

  it("caps competency 5 at 40 per proposal element", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 160, 160, 160, 200], {
        interventionElements: { ...ALL_ELEMENTS, detail: false, means: false },
      }),
      rubric: ENEM,
    });

    expect(grade.criteria[4]?.score).toBe(120);
    expect(grade.total.score).toBe(760);

    expect(grade.enemInterventionElements).toStrictEqual({
      ...ALL_ELEMENTS,
      detail: false,
      means: false,
    });
  });

  it("keeps a lower competency 5 score than the elements allow", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 160, 160, 160, 80]),
      rubric: ENEM,
    });

    expect(grade.criteria[4]?.score).toBe(80);
  });

  it("scores competency 5 as 0 when the model reports no elements", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 160, 160, 160, 160], { interventionElements: null }),
      rubric: ENEM,
    });

    expect(grade.criteria[4]?.score).toBe(0);

    expect(grade.enemInterventionElements).toStrictEqual({
      action: false,
      agent: false,
      detail: false,
      effect: false,
      means: false,
    });
  });

  it("estimates an ENEM range of 40 points around the total, inside 0 to 1000", () => {
    const high = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([200, 200, 200, 200, 200]),
      rubric: ENEM,
    });

    const middle = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 160, 160, 160, 120], {
        interventionElements: { ...ALL_ELEMENTS, means: false },
      }),
      rubric: ENEM,
    });

    const low = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([40, 0, 0, 0, 0]),
      rubric: ENEM,
    });

    expect(high.range).toStrictEqual({ high: 1000, low: 960 });
    expect(middle.range).toStrictEqual({ high: 800, low: 720 });
    expect(low.range).toStrictEqual({ high: 80, low: 0 });
  });

  it("zeroes an annulled ENEM essay and points the next step at the theme", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 120, 120, 160, 120], { zeroReason: "offTopic" }),
      rubric: ENEM,
    });

    expect(grade.zeroReason).toBe("offTopic");
    expect(grade.criteria.every((item) => item.score === 0)).toBe(true);
    expect(grade.total.score).toBe(0);
    expect(grade.range).toStrictEqual({ high: 0, low: 0 });
    expect(grade.nextStep).toStrictEqual({ criterionId: "c2", text: "Next step for 120." });
  });

  it("gives the one next step to the criterion with the most points to gain", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 160, 120, 160, 80], {
        interventionElements: { ...ALL_ELEMENTS, detail: false, means: false },
      }),
      rubric: ENEM,
    });

    expect(grade.nextStep).toStrictEqual({ criterionId: "c5", text: "Next step for 80." });
  });

  it("breaks next-step ties in rubric order", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: enemOutput([160, 120, 160, 120, 160]),
      rubric: ENEM,
    });

    expect(grade.nextStep.criterionId).toBe("c2");
  });

  it("keeps quotes found in the essay as the essay wrote them and drops the rest", () => {
    const output = enemOutput([160, 160, 160, 160, 160]);

    const grade = buildEssayGrade({
      essay: ESSAY,
      output: {
        ...output,
        criteria: {
          ...output.criteria,
          c1: criterion(160, { quote: "  a DESINFORMAÇÃO sobre\nvacinas " }),
          c2: criterion(160, { quote: "A vacinação caiu muito." }),
        },
      },
      rubric: ENEM,
    });

    expect(grade.criteria[0]?.quote).toBe("A desinformação sobre vacinas");
    expect(grade.criteria[1]?.quote).toBeNull();
  });

  it("drops the example at full marks and trims text", () => {
    const output = enemOutput([200, 160, 160, 160, 160]);

    const grade = buildEssayGrade({
      essay: ESSAY,
      output: {
        ...output,
        criteria: {
          ...output.criteria,
          c2: criterion(160, { comment: "  Good theme.  ", example: "   " }),
        },
      },
      rubric: ENEM,
    });

    expect(grade.criteria[0]?.example).toBeNull();
    expect(grade.criteria[1]?.comment).toBe("Good theme.");
    expect(grade.criteria[1]?.example).toBeNull();
    expect(grade.criteria[2]?.example).toBe("Um exemplo melhor.");
  });

  it("scores a criterion the model skipped as 0 without text", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: { ...enemOutput([160, 160, 160, 160, 160]), criteria: {} },
      rubric: ENEM,
    });

    expect(grade.criteria[0]).toMatchObject({ comment: "", example: null, quote: null, score: 0 });
  });

  it("snaps OAB sections to 0.05 inside each section's maximum and ignores ENEM fields", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: {
        criteria: {
          "addressing-and-parties": criterion(0.33),
          "closing-and-form": criterion(0.1),
          facts: criterion(0.5),
          "legal-basis": criterion(1.72),
          requests: criterion(0.61),
        },
        interventionElements: ALL_ELEMENTS,
        zeroReason: "offTopic",
      },
      rubric: OAB,
    });

    expect(grade.criteria.map((item) => item.score)).toStrictEqual([0.35, 0.1, 1.7, 0.6, 0.1]);
    expect(grade.total).toStrictEqual({ maxScore: 5, score: 2.85 });
    expect(grade.range).toStrictEqual({ high: 3.35, low: 2.35 });
    expect(grade.zeroReason).toBeNull();
    expect(grade.enemInterventionElements).toBeNull();
    expect(grade.nextStep.criterionId).toBe("legal-basis");
  });

  it("rounds custom scores to hundredths with a range of a tenth of the maximum", () => {
    const rubric: EssayRubric = {
      criteria: [
        { criterion: "Task response", description: "Answers every part of the prompt" },
        { criterion: "Coherence", description: "Organized paragraphs" },
      ],
      kind: "custom",
      maxScore: 18,
    };

    const grade = buildEssayGrade({
      essay: ESSAY,
      output: {
        criteria: { "criterion-1": criterion(5.004), "criterion-2": criterion(12) },
        interventionElements: null,
        zeroReason: null,
      },
      rubric,
    });

    expect(grade.criteria.map((item) => item.score)).toStrictEqual([5, 9]);
    expect(grade.total).toStrictEqual({ maxScore: 18, score: 14 });
    expect(grade.range).toStrictEqual({ high: 15.8, low: 12.2 });
    expect(grade.nextStep.criterionId).toBe("criterion-1");
  });
});

describe("AP scoring guidelines", () => {
  const rubric: EssayRubric = {
    criteria: [
      { criterion: "Thesis", description: "Makes a defensible claim", points: 1 },
      {
        criterion: "Evidence",
        description: "Supports the claim with specific evidence",
        points: 3,
      },
      { criterion: "Reasoning", description: "Explains how the evidence supports it", points: 2 },
    ],
    kind: "ap",
  };

  it("keeps each row's own points", () => {
    expect(getEssayCriteria(rubric).map((item) => [item.id, item.maxScore])).toStrictEqual([
      ["criterion-1", 1],
      ["criterion-2", 3],
      ["criterion-3", 2],
    ]);
  });

  it("scores whole points within each row, with a point either side as the range", () => {
    const grade = buildEssayGrade({
      essay: ESSAY,
      output: {
        criteria: {
          "criterion-1": criterion(1),
          "criterion-2": criterion(1.6),
          "criterion-3": criterion(4),
        },
        interventionElements: null,
        zeroReason: null,
      },
      rubric,
    });

    expect(grade.criteria.map((item) => item.score)).toStrictEqual([1, 2, 2]);
    expect(grade.total).toStrictEqual({ maxScore: 6, score: 5 });
    expect(grade.range).toStrictEqual({ high: 6, low: 4 });
    expect(grade.nextStep.criterionId).toBe("criterion-2");
  });

  it("rejects a row worth no points", () => {
    expect(() =>
      getEssayCriteria({
        criteria: [{ criterion: "Thesis", description: "A claim", points: 0 }],
        kind: "ap",
      }),
    ).toThrow("at least a point");
  });
});

describe(buildTooShortEssayGrade, () => {
  it("annuls a short ENEM text without model text", () => {
    const grade = buildTooShortEssayGrade(ENEM);

    expect(grade.zeroReason).toBe("tooShort");
    expect(grade.total).toStrictEqual({ maxScore: 1000, score: 0 });
    expect(grade.range).toStrictEqual({ high: 0, low: 0 });
    expect(grade.nextStep).toStrictEqual({ criterionId: "c2", text: "" });
    expect(grade.criteria.every((item) => item.comment === "" && item.score === 0)).toBe(true);
  });

  it("points other rubrics at the section worth the most", () => {
    expect(buildTooShortEssayGrade(OAB).nextStep.criterionId).toBe("legal-basis");
  });
});

describe(findEssayQuote, () => {
  it("matches across quotation mark styles and returns the essay's text", () => {
    const essay = "Como diz o ditado, “quem avisa amigo é”, e o governo não avisou.";

    expect(findEssayQuote({ essay, quote: `"Quem avisa amigo é"` })).toBe("quem avisa amigo é");

    expect(findEssayQuote({ essay, quote: `diz o ditado, "quem avisa` })).toBe(
      "diz o ditado, “quem avisa",
    );
  });

  it("drops edge ellipses and punctuation but keeps inner text exact", () => {
    const essay = "O Estado deve agir (com urgência) já.";

    expect(findEssayQuote({ essay, quote: "...deve agir (com urgência)..." })).toBe(
      "deve agir (com urgência)",
    );

    expect(findEssayQuote({ essay, quote: "deve agir com urgência" })).toBeNull();
  });

  it("ignores quotes too short to point at a passage", () => {
    expect(findEssayQuote({ essay: "a b c", quote: "a" })).toBeNull();
    expect(findEssayQuote({ essay: "a b c", quote: null })).toBeNull();
  });
});
