import { choiceCheck, exampleData, numericCheck } from "@zoonk/testing/fixtures/activity-checks";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import {
  type ActivityTemplateId,
  activityTemplates,
  exploreActivitySchema,
} from "./activity-templates";
import { validateActivity, validateExploreActivity } from "./validate-activity";

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

  it.each(
    Object.entries(engineModeFixtures).flatMap(([template, modes]) =>
      Object.entries(modes).map(([mode, content]) => [`${template} (${mode})`, content] as const),
    ),
  )("accepts the %s mode fixture", (_name, content) => {
    const result = validateActivity(content);

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
    const flatSlider = structuredClone(fixtures.formulaModel);
    flatSlider.fields.variables = [{ ...flatSlider.fields.variables[0]!, max: 0, min: 0 }];

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

    expect(issueCodes({ ...fixtures.codeRunner, check: fixtures.notationPlayer.check })).toContain(
      "checkNotAllowed",
    );
  });

  it("rejects answers written by the model that code computes differently", () => {
    expect(
      issueCodes({
        ...fixtures.formulaModel,
        check: { ...fixtures.formulaModel.check, answer: 4000 },
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

    expect(issueCodes({ ...fixtures.randomSimulation, check: wrongGuess })).toContain(
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
        ...fixtures.randomSimulation,
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
        ...fixtures.formulaModel,
        check: { ...fixtures.formulaModel.check, inputs: [{ name: "rate", value: 50 }] },
      }),
    ).toContain("answerMismatch");

    expect(
      issueCodes({
        ...fixtures.formulaModel,
        check: { ...fixtures.formulaModel.check, inputs: [{ name: "time", value: 5 }] },
      }),
    ).toContain("answerMismatch");
  });

  it("rejects formulas that fail somewhere in their range", () => {
    const growth = fixtures.formulaModel;

    const divideByRate = {
      ...growth,
      check: choiceCheck("What happens?", [
        ["It grows", true],
        ["It shrinks", false],
      ]),
      fields: {
        ...growth.fields,
        outputs: [{ ...growth.fields.outputs[0]!, formula: "1000 / rate" }],
      },
    };

    const unknownName = structuredClone(growth);
    unknownName.fields.outputs = [{ ...growth.fields.outputs[0]!, formula: "1000 * years" }];

    const projectile = engineModeFixtures.formulaModel.simulation;

    const rootOfNegative = {
      ...projectile,
      fields: {
        ...projectile.fields,
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

  it("drops a data label from an activity that shows no data, keeping it where data shows", () => {
    const sorting = validateActivity({ ...fixtures.categorize, data: exampleData });
    const chart = validateActivity({ ...fixtures.chartReader, data: exampleData });

    expect(sorting.ok && sorting.content.data).toBeUndefined();
    expect(chart.ok && chart.content.data).toStrictEqual(exampleData);
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

  it("numbers a labeled picture's parts once each, with names it offers", () => {
    const sameTwice = structuredClone(fixtures.labeledDiagram);
    sameTwice.fields.parts = [...sameTwice.fields.parts, { label: "Septum", part: "Aorta" }];

    const tooMany = structuredClone(fixtures.labeledDiagram);

    tooMany.fields.parts = ["a", "b", "c", "d", "e", "f", "g"].map((part) => ({
      label: part.toUpperCase(),
      part,
    }));

    const unknownMixUp = structuredClone(fixtures.labeledDiagram);
    unknownMixUp.fields.mixUps = [{ feedback: "Why.", labels: ["Aorta", "Vena cava"] }];

    expect(issueCodes(sameTwice)).toContain("inconsistentFields");
    expect(issueCodes(tooMany)).toContain("invalidSchema");
    expect(issueCodes(unknownMixUp)).toContain("inconsistentFields");
  });

  it("lets a part say where it sits, for the drawing, beyond a label's length", () => {
    const placed = structuredClone(fixtures.labeledDiagram);

    placed.fields.parts = placed.fields.parts.map((part, index) =>
      index === 0 ? { ...part, part: "right atrium, upper left as seen from the front" } : part,
    );

    expect(validateActivity(placed).ok).toBe(true);
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

  it("runs a formula model's what-ifs, plot and comparison past its rules", () => {
    const scenario = engineModeFixtures.formulaModel.scenario;
    const projectile = engineModeFixtures.formulaModel.simulation;

    const unusedEvent = structuredClone(scenario);
    unusedEvent.fields.events = [...scenario.fields.events, { label: "Rain", name: "rain" }];

    const plotOnOutput = structuredClone(projectile);
    plotOnOutput.fields.plot = { x: "distance", y: "distance" };

    const farComparison = {
      ...fixtures.formulaModel,
      fields: { ...fixtures.formulaModel.fields, compareAt: 40 },
    };

    expect(issueCodes(unusedEvent)).toContain("missingInteraction");
    expect(issueCodes(plotOnOutput)).toContain("inconsistentFields");
    expect(issueCodes(farComparison)).toContain("inconsistentFields");
  });

  it("asks of each engine mode only the checks it can tie to what the learner does", () => {
    const polls = engineModeFixtures.randomSimulation.sampling;
    const dice = engineModeFixtures.combinationGrid.dice;

    expect(issueCodes({ ...fixtures.randomSimulation, check: numericCheck(0.25) })).toContain(
      "checkNotAllowed",
    );

    expect(issueCodes({ ...polls, check: numericCheck(0.5) })).toStrictEqual([]);

    // 36 cells are too many to fill by hand, so dice are read, never filled.
    expect(
      issueCodes({ ...dice, check: { explanation: "Here is why.", kind: "interaction" } }),
    ).toContain("checkNotAllowed");

    // Polls choices can name an answer without a number; a guess at a chance can't.
    expect(
      issueCodes({
        ...polls,
        check: choiceCheck("Which poll spreads less?", [
          ["The bigger one", true],
          ["The smaller one", false],
        ]),
      }),
    ).toStrictEqual([]);
  });

  it("asks for a source only when a guess reveals cited data", () => {
    const cited = engineModeFixtures.guessReveal.cited;
    const { data: _data, ...uncited } = cited;
    const computed = validateActivity({ ...fixtures.guessReveal, data: exampleData });

    expect(issueCodes(uncited)).toContain("missingDataSource");
    expect(computed.ok && computed.content.data).toBeUndefined();
  });

  it("keeps two lines crossing, before and after the change", () => {
    const market = fixtures.lineCrossing;

    const parallel = structuredClone(market);
    parallel.fields.lines = market.fields.lines.map((line) => ({ ...line, slope: 1 }));

    const flatSideways = structuredClone(engineModeFixtures.lineCrossing.breakEven);

    flatSideways.fields.lines = [
      { id: "cost", intercept: 2000, label: "Cost", slope: 0 },
      { id: "revenue", intercept: 0, label: "Revenue", slope: 15 },
    ];

    flatSideways.fields.shift = { amount: 100, direction: "right", line: "cost" };

    const unknownLine = structuredClone(market);
    unknownLine.fields.shift = { ...market.fields.shift, line: "taxes" };

    expect(issueCodes(parallel)).toContain("inconsistentFields");
    expect(issueCodes(flatSideways)).toContain("missingInteraction");
    expect(issueCodes(unknownLine)).toContain("inconsistentFields");
  });

  it("keeps one gene's letter across a Punnett grid", () => {
    const twoGenes = structuredClone(fixtures.combinationGrid);
    twoGenes.fields.columns = { label: "Other parent", values: ["q", "q"] };

    expect(issueCodes(twoGenes)).toContain("inconsistentFields");
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

/** An activity fixture without what only a question has: the prompt, the check and the picture. */
function explored(id: ActivityTemplateId) {
  const { data, fields, template } = fixtures[id] as {
    data?: unknown;
    fields: unknown;
    template: string;
  };

  return { data, fields, template };
}

const exploreIds = exploreActivitySchema.options.map((option) => option.shape.template.value);

describe(validateExploreActivity, () => {
  it.each(exploreIds)("accepts the %s fixture explored on an explanation screen", (id) => {
    const result = validateExploreActivity(explored(id));

    expect(result.ok ? [] : result.issues).toStrictEqual([]);
  });

  it("refuses templates that only work as a question", () => {
    expect(validateExploreActivity(explored("findError"))).toMatchObject({
      issues: [{ code: "unknownTemplate" }],
      ok: false,
    });

    expect(validateExploreActivity({ fields: {}, template: "confetti" }).ok).toBe(false);
    expect(validateExploreActivity("a map").ok).toBe(false);
  });

  it("runs the template's own rules and the data rule, with no check to verify", () => {
    const flatSlider = structuredClone(explored("formulaModel")) as {
      fields: { variables: { max: number; min: number }[] };
    };

    flatSlider.fields.variables = flatSlider.fields.variables.map((variable) => ({
      ...variable,
      max: 0,
      min: 0,
    }));

    const result = validateExploreActivity(flatSlider);
    const unsourced = validateExploreActivity({ ...explored("chartReader"), data: undefined });

    expect(result.ok ? [] : result.issues.map((item) => item.code)).toContain("missingInteraction");

    expect(unsourced.ok ? [] : unsourced.issues.map((item) => item.code)).toStrictEqual([
      "missingDataSource",
    ]);
  });

  it("keeps no data note on a template that shows no data", () => {
    const result = validateExploreActivity({ ...explored("processOrder"), data: exampleData });

    expect(result.ok && result.content.data).toBeUndefined();
  });
});
