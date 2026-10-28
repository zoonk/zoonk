/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { interactionCheck } from "./activity-checks";

export const computingLanguagesActivities = {
  codeRunner: {
    check: interactionCheck,
    fields: {
      editableLines: [2],
      expectedOutput: "5050",
      language: "python",
      mistakes: [{ feedback: "range stops before its end.", output: "4950" }],
      solution: "total = 0\nfor n in range(1, 101):\n    total += n\nprint(total)",
      starterCode: "total = 0\nfor n in range(1, 100):\n    total += n\nprint(total)",
    },
    prompt: "Fix the loop so it adds every whole number from 1 to 100.",
    template: "codeRunner",
  },
  codeTracer: {
    check: interactionCheck,
    fields: {
      code: "let lo = 0, hi = 7;\nwhile (lo <= hi) {\n  const mid = Math.floor((lo + hi) / 2);\n  if (mid < 6) lo = mid + 1;\n  else if (mid > 6) hi = mid - 1;\n  else break;\n}",
      language: "javascript",
      pauses: [
        {
          options: [
            { id: "a", text: "5" },
            { id: "b", text: "6" },
            { id: "c", text: "7" },
          ],
          question: "What will mid be on pass 3?",
          step: 3,
          variable: "mid",
        },
      ],
      trace: [
        {
          line: 1,
          values: [
            { name: "lo", value: 0 },
            { name: "hi", value: 7 },
          ],
        },
        {
          line: 3,
          values: [
            { name: "lo", value: 0 },
            { name: "mid", value: 3 },
          ],
        },
        {
          line: 3,
          values: [
            { name: "lo", value: 4 },
            { name: "mid", value: 5 },
          ],
        },
        {
          line: 3,
          values: [
            { name: "lo", value: 6 },
            { name: "mid", value: 6 },
          ],
        },
      ],
      watch: ["lo", "hi", "mid"],
    },
    prompt: "Find position 6 by halving the range each pass.",
    template: "codeTracer",
  },
  dialogueSimulator: {
    check: {
      explanation:
        "She spoke to you as usted (dígame), so tiene matches her tone. Greeting before you ask is expected in Spanish shops.",
      kind: "interaction",
    },
    fields: {
      language: "es",
      lines: [
        {
          speaker: "them",
          text: "Buenos días, dígame.",
          translation: "Good morning, how can I help?",
        },
      ],
      replies: [
        {
          id: "polite",
          isBest: true,
          text: "Buenos días. ¿Tiene algo para el dolor de garganta?",
          translation: "Good morning. Do you have anything for a sore throat?",
          why: "A greeting first, then usted (tiene), matching how she spoke to you.",
        },
        {
          id: "blunt",
          isBest: false,
          text: "Dame algo para la garganta.",
          translation: "Give me something for my throat.",
          why: "No greeting and a bare command sound rude to a stranger.",
        },
        {
          id: "slang",
          isBest: false,
          text: "Oye, ¿tienes algo para la garganta, tío?",
          translation: "Hey, got anything for the throat, mate?",
          why: "Tú and tío are for friends, not a pharmacist you just met.",
        },
      ],
      scene: "A pharmacy in Chamberí, Madrid",
    },
    prompt: "You have a sore throat. How do you answer?",
    template: "dialogueSimulator",
  },
  patternTable: {
    check: interactionCheck,
    fields: {
      choices: ["áis", "éis", "ís", "en"],
      modelMeaning: "to speak",
      modelWord: "hablar",
      newMeaning: "to eat",
      newWord: "comer",
      rows: [
        { answer: "como", blank: false, label: "yo", labelMeaning: "I", model: "hablo" },
        { answer: "comes", blank: false, label: "tú", labelMeaning: "you", model: "hablas" },
        {
          answer: "come",
          blank: false,
          label: "él, ella, usted",
          labelMeaning: "he, she, you (formal)",
          model: "habla",
        },
        {
          answer: "comemos",
          blank: false,
          label: "nosotros",
          labelMeaning: "we",
          model: "hablamos",
        },
        {
          answer: "coméis",
          blank: true,
          label: "vosotros",
          labelMeaning: "you all (Spain)",
          model: "habláis",
        },
        {
          answer: "comen",
          blank: true,
          label: "ellos, ustedes",
          labelMeaning: "they, you all (formal)",
          model: "hablan",
        },
      ],
    },
    prompt: "Use the pattern from hablar to finish comer.",
    template: "patternTable",
  },
  patternTester: {
    check: interactionCheck,
    fields: {
      hints: [{ hint: "Say where the text must end.", mistake: "Matches extra digits" }],
      mode: "regex",
      shouldMatch: ["94103", "94103-1234"],
      shouldNotMatch: ["9410", "941031", "94103-12"],
      solution: String.raw`^\d{5}(-\d{4})?$`,
      task: "Match US ZIP codes, like 94103 or 94103-1234.",
    },
    prompt: "Write the pattern.",
    template: "patternTester",
  },
  sqlPlayground: {
    check: interactionCheck,
    data: {
      source: { publisher: "United Nations", title: "World Population Prospects", year: 2024 },
    },
    fields: {
      expected: {
        columns: ["name", "pop_millions"],
        orderMatters: true,
        rows: [
          ["India", 1451],
          ["China", 1419],
          ["Indonesia", 283],
        ],
      },
      mistakes: [
        { feedback: "OR keeps rows that pass either test.", mistake: "Used OR instead of AND" },
      ],
      solution:
        "SELECT name, pop_millions FROM countries WHERE continent = 'Asia' AND pop_millions > 200 ORDER BY pop_millions DESC;",
      tables: [
        {
          columns: [
            { name: "name", type: "text" },
            { name: "continent", type: "text" },
            { name: "pop_millions", type: "integer" },
          ],
          name: "countries",
          rows: [
            ["India", "Asia", 1451],
            ["China", "Asia", 1419],
            ["Brazil", "South America", 212],
            ["Indonesia", "Asia", 283],
          ],
        },
      ],
    },
    prompt: "Which countries in Asia have more than 200 million people?",
    template: "sqlPlayground",
  },
};
