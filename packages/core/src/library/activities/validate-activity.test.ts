import { choiceCheck, exampleData, numericCheck } from "@zoonk/testing/fixtures/activity-checks";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { type ActivityTemplateId, activityTemplates } from "./activity-templates";
import { validateActivity } from "./validate-activity";

/** Every template needs a fixture: the map won't satisfy this type with one missing. */
const fixtures = activityContentFixtures satisfies Record<ActivityTemplateId, unknown>;

function issueCodes(content: unknown): string[] {
  const result = validateActivity(content);
  return result.ok ? [] : result.issues.map((item) => item.code);
}

describe(validateActivity, () => {
  it.each(activityTemplates.map((template) => template.id))("accepts the %s fixture", (id) => {
    const result = validateActivity(fixtures[id]);

    expect(result.ok ? [] : result.issues).toStrictEqual([]);
  });

  it("rejects an unknown template and a missing check", () => {
    expect(issueCodes({ ...fixtures.numberLine, template: "confetti" })).toContain(
      "unknownTemplate",
    );

    expect(issueCodes({ ...fixtures.numberLine, check: undefined })).toContain("missingCheck");
    expect(issueCodes("not an activity")).toContain("invalidSchema");
  });

  it("rejects decorative activities with nothing to move", () => {
    const flatSlider = structuredClone(fixtures.sliderGraph);
    flatSlider.fields.variable = { ...flatSlider.fields.variable, max: 0, min: 0 };

    const noJumps = structuredClone(fixtures.numberLine);
    noJumps.fields.moves = [{ by: 0 }];

    const nothingToFind = structuredClone(fixtures.sourceComparison);

    nothingToFind.fields.sources = nothingToFind.fields.sources.map((source) => ({
      ...source,
      passages: source.passages.map((passage) => ({ ...passage, isTarget: false })),
    }));

    expect(issueCodes(flatSlider)).toContain("missingInteraction");
    expect(issueCodes(noJumps)).toContain("missingInteraction");
    expect(issueCodes(nothingToFind)).toContain("missingInteraction");
  });

  it("rejects a code runner solution the learner can't reach by fixing their lines", () => {
    const otherLine = structuredClone(fixtures.codeRunner);
    otherLine.fields.solution = otherLine.fields.solution.replace("total = 0", "total = 1");

    const nothingToFix = structuredClone(fixtures.codeRunner);
    nothingToFix.fields.solution = nothingToFix.fields.starterCode;

    expect(validateActivity(otherLine)).toStrictEqual({
      issues: [
        {
          code: "inconsistentFields",
          message: "The solution must be the starter code with only the editable lines changed",
          path: "fields.solution",
        },
      ],
      ok: false,
    });

    expect(issueCodes(nothingToFix)).toStrictEqual(["missingInteraction"]);
  });

  it("rejects a check kind the template can't tie to its interaction", () => {
    expect(issueCodes({ ...fixtures.timeline, check: fixtures.numberLine.check })).toContain(
      "checkNotAllowed",
    );

    expect(issueCodes({ ...fixtures.codeRunner, check: fixtures.listeningSpeed.check })).toContain(
      "checkNotAllowed",
    );
  });

  it("rejects answers written by the model that code computes differently", () => {
    expect(
      issueCodes({
        ...fixtures.sliderGraph,
        check: { ...fixtures.sliderGraph.check, answer: 4000 },
      }),
    ).toContain("answerMismatch");

    expect(issueCodes({ ...fixtures.balance, check: numericCheck(4) })).toContain("answerMismatch");

    const wrongStep = structuredClone(fixtures.stepSolver);
    wrongStep.fields.steps[1] = { ...wrongStep.fields.steps[1]!, value: 4.8 };
    expect(issueCodes(wrongStep)).toContain("answerMismatch");

    const wrongGuess = choiceCheck("How often?", [
      ["About half the time", true, 0.5],
      ["About 1 in 4", false, 0.25],
    ]);

    expect(issueCodes({ ...fixtures.predictSimulate, check: wrongGuess })).toContain(
      "answerMismatch",
    );

    const wrongTrace = structuredClone(fixtures.codeTracer);

    wrongTrace.fields.pauses[0] = {
      ...wrongTrace.fields.pauses[0]!,
      options: [
        { id: "a", text: "5" },
        { id: "b", text: "7" },
      ],
    };

    expect(issueCodes(wrongTrace)).toContain("answerMismatch");

    expect(
      issueCodes({
        ...fixtures.findError,
        fields: { ...fixtures.findError.fields, errorStepId: "s1" },
      }),
    ).toContain("answerMismatch");
  });

  it("requires every guess option to carry its value when the answer is only a number", () => {
    expect(
      issueCodes({
        ...fixtures.predictSimulate,
        check: choiceCheck("How often?", [
          ["Often", true],
          ["Rarely", false],
        ]),
      }),
    ).toContain("answerMismatch");
  });

  it("rejects a numeric check whose inputs sit outside the slider range", () => {
    expect(
      issueCodes({
        ...fixtures.sliderGraph,
        check: { ...fixtures.sliderGraph.check, inputs: [{ name: "rate", value: 50 }] },
      }),
    ).toContain("answerMismatch");

    expect(
      issueCodes({
        ...fixtures.sliderGraph,
        check: { ...fixtures.sliderGraph.check, inputs: [{ name: "time", value: 5 }] },
      }),
    ).toContain("answerMismatch");
  });

  it("rejects formulas that fail somewhere in their range", () => {
    const divideByRate = {
      ...fixtures.sliderGraph,
      check: choiceCheck("What happens?", [
        ["It grows", true],
        ["It shrinks", false],
      ]),
      fields: { ...fixtures.sliderGraph.fields, formula: "1000 / rate" },
    };

    const unknownName = structuredClone(fixtures.sliderGraph);
    unknownName.fields.formula = "1000 * years";

    const rootOfNegative = {
      ...fixtures.parameterSimulation,
      fields: {
        ...fixtures.parameterSimulation.fields,
        outputs: [{ formula: "sqrt(angle - 10)", id: "distance", label: "Lands at" }],
      },
    };

    expect(issueCodes(divideByRate)).toContain("formulaFails");
    expect(issueCodes(unknownName)).toContain("formulaFails");
    expect(issueCodes(rootOfNegative)).toContain("formulaFails");
  });

  it("requires a cited source or an example label for activities that show data", () => {
    const { check, fields, prompt, template } = fixtures.chartReader;
    expect(issueCodes({ check, fields, prompt, template })).toContain("missingDataSource");
    expect(validateActivity({ ...fixtures.chartReader, data: exampleData }).ok).toBe(true);
  });

  it("reports labels that don't fit as labelTooLong", () => {
    const longLabel = structuredClone(fixtures.numberLine);
    longLabel.fields.label = "A temperature reading taken every hour at the station";
    expect(issueCodes(longLabel)).toContain("labelTooLong");
  });

  it("rejects inconsistent template data", () => {
    const partsOff = structuredClone(fixtures.areaModel);

    partsOff.fields = {
      height: { parts: [10, 4], total: 14 },
      model: "area",
      unit: "m",
      width: { parts: [20, 4], total: 23 },
    };

    const sameYear = structuredClone(fixtures.timeline);

    sameYear.fields.events = [
      { id: "a", label: "First", year: 1969 },
      { id: "b", label: "Second", year: 1969 },
    ];

    const loop = structuredClone(fixtures.causeEffectChain);
    loop.fields.links = [...loop.fields.links, { from: "dust", to: "plow", why: "Loops back." }];

    const unbuildable = structuredClone(fixtures.moleculeBuilder);
    unbuildable.fields.formula = "CH2";

    const wrongRegex = structuredClone(fixtures.patternTester);
    wrongRegex.fields = { ...fixtures.patternTester.fields, solution: String.raw`^\d{5}` };

    const slowRegex = structuredClone(fixtures.patternTester);
    slowRegex.fields = { ...fixtures.patternTester.fields, solution: String.raw`^(\d+)+$` };

    expect(issueCodes(partsOff)).toContain("inconsistentFields");
    expect(issueCodes(sameYear)).toContain("inconsistentFields");
    expect(issueCodes(loop)).toContain("inconsistentFields");
    expect(issueCodes(unbuildable)).toContain("inconsistentFields");
    expect(issueCodes(wrongRegex)).toContain("answerMismatch");
    expect(issueCodes(slowRegex)).toContain("inconsistentFields");
  });

  it("asks a geometry board only for numbers that stay the same as corners move", () => {
    const board = fixtures.geometryBoard;

    const triangle = [
      { id: "a", movable: false, x: 0, y: 0 },
      { id: "b", movable: false, x: 6, y: 0 },
      { id: "c", movable: true, track: "horizontal", x: 2, y: 4 },
    ];

    const slidingArea = {
      ...board,
      check: numericCheck(12),
      fields: { ...board.fields, measure: "area", points: triangle },
    };

    const freeArea = structuredClone(slidingArea);
    freeArea.fields.points[2] = { id: "c", movable: true, x: 2, y: 4 };

    expect(validateActivity(slidingArea).ok).toBe(true);
    expect(issueCodes(freeArea)).toContain("answerMismatch");

    expect(issueCodes({ ...board, fields: { ...board.fields, measure: "perimeter" } })).toContain(
      "answerMismatch",
    );
  });

  it("keeps a Pythagoras board's right angle as its corners move", () => {
    const board = {
      ...fixtures.geometryBoard,
      check: choiceCheck("What stays true?", [
        ["The two small squares fill the big one", true],
        ["All three squares grow", false],
      ]),
      fields: {
        invariant: "a² + b² = c²",
        measure: "pythagoras",
        points: [
          { id: "a", movable: false, x: 0, y: 0 },
          { id: "b", movable: true, track: "horizontal", x: 4, y: 0 },
          { id: "c", movable: true, track: "vertical", x: 0, y: 3 },
        ],
      },
    };

    const freeCorner = structuredClone(board);
    freeCorner.fields.points[1] = { id: "b", movable: true, x: 4, y: 0 };

    const movingRightAngle = structuredClone(board);
    movingRightAngle.fields.points[0] = { id: "a", movable: true, x: 0, y: 0 };

    expect(validateActivity(board).ok).toBe(true);
    expect(issueCodes(freeCorner)).toContain("inconsistentFields");
    expect(issueCodes(movingRightAngle)).toContain("inconsistentFields");
  });

  it("keeps unit circle angles within one turn", () => {
    const circle = fixtures.unitCircle;

    expect(issueCodes({ ...circle, fields: { ...circle.fields, startAngle: 400 } })).toContain(
      "inconsistentFields",
    );

    expect(
      issueCodes({
        ...circle,
        check: { ...circle.check, inputs: [{ name: "angle", value: 390 }] },
      }),
    ).toContain("answerMismatch");
  });

  it("only labels diagrams and parts the checked drawings have", () => {
    const unknownDiagram = structuredClone(fixtures.labeledDiagram);
    unknownDiagram.fields.diagramId = "human-spleen";

    const unknownPart = structuredClone(fixtures.labeledDiagram);
    unknownPart.fields.parts = [...unknownPart.fields.parts, { label: "Valve", partId: "valve" }];

    expect(issueCodes(unknownDiagram)).toStrictEqual(["unknownAsset"]);
    expect(issueCodes(unknownPart)).toStrictEqual(["unknownAsset"]);
  });

  it("offers only icons the player draws for process steps", () => {
    const madeUpIcon = structuredClone(fixtures.processOrder);

    madeUpIcon.fields.steps = madeUpIcon.fields.steps.map((step) => ({
      ...step,
      icon: "sunshine",
    }));

    expect(issueCodes(madeUpIcon)).toContain("invalidSchema");
  });

  it("rejects molecules that can't be built with at most triple bonds or are too big", () => {
    const quadrupleBond = structuredClone(fixtures.moleculeBuilder);
    quadrupleBond.fields = { elements: ["C"], formula: "C2" };

    const glucose = structuredClone(fixtures.moleculeBuilder);
    glucose.fields = { elements: ["C", "H", "O"], formula: "C6H12O6" };

    expect(issueCodes(quadrupleBond)).toStrictEqual(["inconsistentFields"]);
    expect(issueCodes(glucose)).toStrictEqual(["inconsistentFields"]);
  });

  it("accepts a formula-mode pattern tester only when the solution gives every output", () => {
    const formula = {
      ...fixtures.patternTester,
      fields: {
        examples: [
          { inputs: [{ name: "A1", value: 40 }], output: 6 },
          { inputs: [{ name: "A1", value: 100 }], output: 15 },
        ],
        hints: [],
        mode: "formula",
        solution: "=A1*0.15",
        task: "Write a formula for a 15% tip.",
        tolerance: { kind: "absolute", value: 0.001 },
      },
    };

    expect(validateActivity(formula).ok).toBe(true);

    expect(
      issueCodes({ ...formula, fields: { ...formula.fields, solution: "=A1*0.2" } }),
    ).toContain("answerMismatch");
  });
});
