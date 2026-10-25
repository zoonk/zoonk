import { describe, expect, it } from "vitest";
import { type ActivityAnswer } from "./activity-answer-schema";
import { checkActivityAnswer } from "./activity-answers";
import { activityContentSchema } from "./activity-templates";

const interaction = { explanation: "Here is why.", kind: "interaction" };

function content(template: string, fields: object, check: object = interaction) {
  return activityContentSchema.parse({
    check,
    data: { isExample: true },
    fields,
    prompt: "Try it.",
    template,
  });
}

function grade(activity: ReturnType<typeof content>, answer: ActivityAnswer): boolean {
  return checkActivityAnswer(activity, answer);
}

describe(checkActivityAnswer, () => {
  it("grades choice and numeric checks from the check itself", () => {
    const numberLine = content(
      "numberLine",
      { label: "Temperature", max: 7, min: -5, moves: [{ by: 8 }], start: -3, step: 1 },
      {
        answer: 5,
        explanation: "Why.",
        kind: "numeric",
        question: "Where?",
        tolerance: { kind: "absolute", value: 0.5 },
      },
    );

    const listening = content(
      "keyboardFretboard",
      { byEar: true, instruments: ["piano"], target: { kind: "notes", notes: ["C", "G"] } },
      {
        kind: "choice",
        options: [
          { id: "a", isCorrect: true, reason: "Yes.", text: "A perfect fifth" },
          { id: "b", isCorrect: false, reason: "No.", text: "A major third" },
        ],
        question: "What did you hear?",
      },
    );

    expect(grade(numberLine, { kind: "numeric", value: 5.4 })).toBe(true);
    expect(grade(numberLine, { kind: "numeric", value: 6 })).toBe(false);
    expect(grade(numberLine, { kind: "choice", optionId: "a" })).toBe(false);
    expect(grade(listening, { kind: "choice", optionId: "a" })).toBe(true);
    expect(grade(listening, { kind: "choice", optionId: "b" })).toBe(false);
  });

  it("counts a guess on the scale within a tenth of the real value, or the check's wider tolerance", () => {
    const fields = {
      max: 1_000_000_000,
      min: 1,
      scale: "log",
      takeaway: "Dividing powers of ten subtracts them.",
      truth: {
        expression: "7 * 10^(-5) / (1 * 10^(-10))",
        kind: "computed",
        workings: [{ expression: "7 * 10^(-5) / (1 * 10^(-10))", label: "Atoms across" }],
      },
      unit: "atoms",
    };

    const check = {
      answer: 700_000,
      explanation: "Why.",
      kind: "numeric",
      question: "How many atoms fit across the hair?",
    };

    const strict = content("guessReveal", fields, {
      ...check,
      tolerance: { kind: "relative", value: 0.01 },
    });

    const loose = content("guessReveal", fields, {
      ...check,
      tolerance: { kind: "relative", value: 0.25 },
    });

    // The slider's nearest positions to 700,000 are 640,000 and 710,000: a guess can't do better.
    expect(grade(strict, { kind: "numeric", value: 710_000 })).toBe(true);
    expect(grade(strict, { kind: "numeric", value: 660_000 })).toBe(true);
    expect(grade(strict, { kind: "numeric", value: 790_000 })).toBe(false);
    expect(grade(loose, { kind: "numeric", value: 790_000 })).toBe(true);
  });

  it("counts a guess exactly a tenth away, which floating point puts a hair past it", () => {
    const guess = content(
      "guessReveal",
      {
        max: 2,
        min: 0,
        scale: "linear",
        takeaway: "A liter is a thousand milliliters.",
        truth: { kind: "cited", value: 1 },
        unit: "liters",
      },
      {
        answer: 1,
        explanation: "Why.",
        kind: "numeric",
        question: "How many liters fill the bottle?",
        tolerance: { kind: "relative", value: 0.01 },
      },
    );

    // 1.1 - 1 is 0.10000000000000009 in floating point.
    expect(grade(guess, { kind: "numeric", value: 1.1 })).toBe(true);
    expect(grade(guess, { kind: "numeric", value: 0.9 })).toBe(true);
    expect(grade(guess, { kind: "numeric", value: 1.1001 })).toBe(false);
  });

  it.each([1e-8, 1e-12])("keeps a small-unit guess's tolerance relative to %s", (expected) => {
    const guess = content(
      "guessReveal",
      {
        max: 2 * expected,
        min: 0,
        scale: "linear",
        takeaway: "Lengths can be measured in meters.",
        truth: { kind: "cited", value: expected },
        unit: "m",
      },
      {
        answer: expected,
        explanation: "Why.",
        kind: "numeric",
        question: "How long is it?",
        tolerance: { kind: "relative", value: 0.1 },
      },
    );

    expect(grade(guess, { kind: "numeric", value: expected * 1.1 })).toBe(true);
    expect(grade(guess, { kind: "numeric", value: expected * 0.9 })).toBe(true);
    expect(grade(guess, { kind: "numeric", value: expected * 1.2 })).toBe(false);
    expect(grade(guess, { kind: "numeric", value: expected * 0.8 })).toBe(false);
  });

  it.each([
    { kind: "relative", value: 0.1 },
    { kind: "absolute", value: 1e-9 },
  ])("keeps formula examples' $kind tolerance small", (tolerance) => {
    const formula = content("patternTester", {
      examples: [
        { inputs: [{ name: "length", value: 1e-8 }], output: 1e-8 },
        { inputs: [{ name: "length", value: 5e-9 }], output: 5e-9 },
      ],
      hints: [],
      mode: "formula",
      solution: "length",
      task: "Return the length in meters.",
      tolerance,
    });

    expect(grade(formula, { kind: "pattern", pattern: "length * 1.1" })).toBe(true);
    expect(grade(formula, { kind: "pattern", pattern: "length * 1.2" })).toBe(false);
  });

  it("orders timeline events by their dates, not by how they were written", () => {
    const timeline = content("timeline", {
      anchors: [{ label: "Great Pyramid", year: -2560 }],
      end: 2000,
      events: [
        { id: "moon", label: "Moon landing", year: 1969 },
        { id: "cleo", label: "Cleopatra", year: -51 },
      ],
      start: -3000,
    });

    expect(grade(timeline, { ids: ["cleo", "moon"], kind: "order" })).toBe(true);
    expect(grade(timeline, { ids: ["moon", "cleo"], kind: "order" })).toBe(false);
  });

  it("grades assignments and selections as data", () => {
    const categorize = content("categorize", {
      groups: [
        { id: "chemical", label: "New substance", rule: "Something new forms." },
        { id: "physical", label: "Same substance", rule: "Only the form changes." },
      ],
      items: [
        { groupId: "chemical", id: "burn", text: "Burning wood", why: "Ash forms." },
        { groupId: "physical", id: "melt", text: "Melting ice", why: "Still water." },
        { groupId: "chemical", id: "rust", text: "Rusting iron", why: "Oxide forms." },
      ],
    });

    const dialogue = content("dialogueSimulator", {
      language: "es",
      lines: [{ speaker: "them", text: "¿Qué necesita?", translation: "What do you need?" }],
      replies: [
        {
          id: "polite",
          isBest: true,
          text: "Quería algo.",
          translation: "I'd like something.",
          why: "Polite.",
        },
        {
          id: "blunt",
          isBest: false,
          text: "Dame algo.",
          translation: "Give me something.",
          why: "Blunt.",
        },
      ],
      scene: "A pharmacy.",
    });

    expect(
      grade(categorize, {
        kind: "assignment",
        pairs: { burn: "chemical", melt: "physical", rust: "chemical" },
      }),
    ).toBe(true);

    expect(
      grade(categorize, {
        kind: "assignment",
        pairs: { burn: "chemical", melt: "chemical", rust: "chemical" },
      }),
    ).toBe(false);

    expect(
      grade(categorize, { kind: "assignment", pairs: { burn: "chemical", melt: "physical" } }),
    ).toBe(false);

    expect(grade(dialogue, { ids: ["polite"], kind: "selection" })).toBe(true);
    expect(grade(dialogue, { ids: ["blunt"], kind: "selection" })).toBe(false);
  });

  it("accepts any complete molecule with the formula's atoms and rejects missing bonds", () => {
    const molecule = content("moleculeBuilder", { elements: ["C", "O"], formula: "CO2" });

    const atoms = [
      { element: "O", id: "o1" },
      { element: "C", id: "c" },
      { element: "O", id: "o2" },
    ];

    expect(
      grade(molecule, {
        atoms,
        bonds: [
          { from: "o1", order: 2, to: "c" },
          { from: "c", order: 2, to: "o2" },
        ],
        kind: "molecule",
      }),
    ).toBe(true);

    expect(
      grade(molecule, {
        atoms,
        bonds: [
          { from: "o1", order: 2, to: "c" },
          { from: "c", order: 1, to: "o2" },
        ],
        kind: "molecule",
      }),
    ).toBe(false);
  });

  it("fills a Punnett grid from the alleles, whatever order the learner writes them in", () => {
    const punnett = content("combinationGrid", {
      columns: { label: "White", values: ["p", "p"] },
      rows: { label: "Purple", values: ["P", "p"] },
      rule: "alleles",
      title: "Flower color",
      traits: { dominant: "Purple", recessive: "White" },
    });

    expect(grade(punnett, { cells: ["Pp", "pP", "pp", "pp"], kind: "grid" })).toBe(true);
    expect(grade(punnett, { cells: ["Pp", "Pp", "Pp", "pp"], kind: "grid" })).toBe(false);
  });

  it("fills a number grid by its rule, reading each number as written", () => {
    const sums = content("combinationGrid", {
      columns: { label: "Second", values: [1, 11] },
      rows: { label: "First", values: [1, 10] },
      rule: "sum",
      title: "Sums",
    });

    expect(grade(sums, { cells: ["2", "12", "11", "21"], kind: "grid" })).toBe(true);
    // 12 and 21 have the same digits but aren't the same number.
    expect(grade(sums, { cells: ["2", "21", "11", "12"], kind: "grid" })).toBe(false);
  });

  it("runs the learner's pattern against the examples", () => {
    const zip = content("patternTester", {
      hints: [],
      mode: "regex",
      shouldMatch: ["94103", "94103-1234"],
      shouldNotMatch: ["9410", "941031"],
      solution: String.raw`^\d{5}(-\d{4})?$`,
      task: "Match US ZIP codes.",
    });

    const tip = content("patternTester", {
      examples: [
        { inputs: [{ name: "A1", value: 40 }], output: 6 },
        { inputs: [{ name: "A1", value: 100 }], output: 15 },
      ],
      hints: [],
      mode: "formula",
      solution: "A1*0.15",
      task: "A 15% tip.",
      tolerance: { kind: "absolute", value: 0.001 },
    });

    expect(grade(zip, { kind: "pattern", pattern: String.raw`^[0-9]{5}(-[0-9]{4})?$` })).toBe(true);
    expect(grade(zip, { kind: "pattern", pattern: String.raw`\d{5}` })).toBe(false);
    expect(grade(zip, { kind: "pattern", pattern: "(" })).toBe(false);
    expect(grade(tip, { kind: "pattern", pattern: "=A1 * 15 / 100" })).toBe(true);
    expect(grade(tip, { kind: "pattern", pattern: "=A1 * 0.2" })).toBe(false);
  });

  it("compares program output and query results", () => {
    const runner = content("codeRunner", {
      editableLines: [1],
      expectedOutput: "5050\n",
      language: "python",
      mistakes: [],
      solution: "print(sum(range(1, 101)))",
      starterCode: "print(sum(range(1, 101)))",
    });

    const query = content("sqlPlayground", {
      expected: { columns: ["name"], orderMatters: false, rows: [["India"], ["China"]] },
      mistakes: [],
      solution: "SELECT name FROM countries;",
      tables: [
        {
          columns: [{ name: "name", type: "text" }],
          name: "countries",
          rows: [["India"], ["China"]],
        },
      ],
    });

    expect(grade(runner, { kind: "output", output: "5050  \n\n" })).toBe(true);
    expect(grade(runner, { kind: "output", output: "4950" })).toBe(false);

    expect(grade(query, { columns: ["NAME"], kind: "rows", rows: [["China"], ["India"]] })).toBe(
      true,
    );

    expect(grade(query, { columns: ["name"], kind: "rows", rows: [["China"]] })).toBe(false);
  });

  it("grades music by pitch class and rhythm by timing", () => {
    const chord = content("keyboardFretboard", {
      instruments: ["piano"],
      target: { kind: "chord", quality: "minor", root: "C" },
    });

    const clave = content("rhythmTapper", {
      pattern: "x..x",
      rounds: 1,
      stepsPerBeat: 4,
      tempo: 60,
      toleranceMs: 50,
    });

    expect(grade(chord, { kind: "notes", notes: ["C4", "Eb4", "G4"] })).toBe(true);
    expect(grade(chord, { kind: "notes", notes: ["C3", "D#5", "G2"] })).toBe(true);
    expect(grade(chord, { kind: "notes", notes: ["C4", "E4", "G4"] })).toBe(false);
    expect(grade(clave, { kind: "rhythm", tapTimesMs: [120, 880] })).toBe(true);
    expect(grade(clave, { kind: "rhythm", tapTimesMs: [120, 1020] })).toBe(false);
    expect(grade(clave, { kind: "rhythm", tapTimesMs: [120] })).toBe(false);
    expect(grade(clave, { kind: "rhythm", tapTimesMs: [500, 1250] })).toBe(false);
  });

  it("grades line shifts and cause and effect links", () => {
    const market = content("lineCrossing", {
      change: "Bird flu.",
      feedback: { wrongDirection: "Less supply.", wrongLine: "Not demand." },
      lines: [
        { id: "supply", intercept: 1, label: "Supply", slope: 0.5 },
        { id: "demand", intercept: 10, label: "Demand", slope: -1 },
      ],
      shift: { amount: 2, direction: "left", line: "supply" },
      xLabel: "Eggs",
      yLabel: "Price",
    });

    const chain = content("causeEffectChain", {
      links: [
        { from: "plow", to: "dust", why: "Bare soil." },
        { from: "drought", to: "dust", why: "Dry soil." },
      ],
      nodes: [
        { id: "plow", label: "Plowing" },
        { id: "drought", label: "Drought" },
        { id: "dust", label: "Dust storms" },
      ],
    });

    expect(grade(market, { curve: "supply", direction: "left", kind: "curveShift" })).toBe(true);
    expect(grade(market, { curve: "demand", direction: "left", kind: "curveShift" })).toBe(false);

    expect(
      grade(chain, {
        kind: "links",
        links: [
          { from: "drought", to: "dust" },
          { from: "plow", to: "dust" },
        ],
      }),
    ).toBe(true);

    expect(
      grade(chain, {
        kind: "links",
        links: [
          { from: "dust", to: "plow" },
          { from: "drought", to: "dust" },
        ],
      }),
    ).toBe(false);
  });
});
