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
      "listeningSpeed",
      { language: "es", script: "Hola.", speeds: [0.75, 1] },
      {
        kind: "choice",
        options: [
          { id: "a", isCorrect: true, reason: "Yes.", text: "Hello" },
          { id: "b", isCorrect: false, reason: "No.", text: "Bye" },
        ],
        question: "What did they say?",
      },
    );

    expect(grade(numberLine, { kind: "numeric", value: 5.4 })).toBe(true);
    expect(grade(numberLine, { kind: "numeric", value: 6 })).toBe(false);
    expect(grade(numberLine, { kind: "choice", optionId: "a" })).toBe(false);
    expect(grade(listening, { kind: "choice", optionId: "a" })).toBe(true);
    expect(grade(listening, { kind: "choice", optionId: "b" })).toBe(false);
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

  it("fills the Punnett square from the alleles, whatever order the learner writes them in", () => {
    const punnett = content("punnettSquare", {
      parents: [
        { alleles: ["P", "p"], label: "Purple" },
        { alleles: ["p", "p"], label: "White" },
      ],
      phenotypes: { dominant: "Purple", recessive: "White" },
      trait: "Flower color",
    });

    expect(grade(punnett, { cells: ["Pp", "pP", "pp", "pp"], kind: "grid" })).toBe(true);
    expect(grade(punnett, { cells: ["Pp", "Pp", "Pp", "pp"], kind: "grid" })).toBe(false);
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

  it("compares program output, query results and built sentences", () => {
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

    const sentence = content("sentenceBuilder", {
      acceptedVariants: ["¿Venís a cenar?"],
      distractors: [{ why: "That's for ustedes.", word: "Quieren" }],
      language: "es",
      prompt: "Do you all want to come to dinner?",
      situation: "Inviting friends.",
      target: "¿Queréis venir a cenar?",
    });

    expect(grade(runner, { kind: "output", output: "5050  \n\n" })).toBe(true);
    expect(grade(runner, { kind: "output", output: "4950" })).toBe(false);

    expect(grade(query, { columns: ["NAME"], kind: "rows", rows: [["China"], ["India"]] })).toBe(
      true,
    );

    expect(grade(query, { columns: ["name"], kind: "rows", rows: [["China"]] })).toBe(false);
    expect(grade(sentence, { kind: "text", text: " ¿Queréis  venir a cenar? " })).toBe(true);
    expect(grade(sentence, { kind: "text", text: "¿Venís a cenar?" })).toBe(true);
    expect(grade(sentence, { kind: "text", text: "¿Quieren venir a cenar?" })).toBe(false);
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

  it("grades curve shifts and cause and effect links", () => {
    const market = content("supplyDemand", {
      demand: { intercept: 10, slope: -1 },
      event: "Bird flu.",
      feedback: { wrongCurve: "Not demand.", wrongDirection: "Less supply." },
      priceLabel: "Price",
      quantityLabel: "Eggs",
      shift: { amount: 2, curve: "supply", direction: "left" },
      supply: { intercept: 1, slope: 0.5 },
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
