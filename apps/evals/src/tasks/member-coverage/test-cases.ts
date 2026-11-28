import { type TestCase } from "@/lib/types";
import { type MemberCoverageParams } from "@zoonk/ai/tasks/curriculum/member-coverage";
import { BIBLE_BOOKS_SKILLS, QURAN_MEMORIZATION_SKILLS } from "./complete-set-graphs";
import { type MemberCoverageExpected } from "./scorer";

type MemberCoverageTestCase = TestCase<MemberCoverageExpected, MemberCoverageParams>;

function toSkills(pairs: readonly (readonly [string, string])[]): MemberCoverageParams["skills"] {
  return pairs.map(([key, name]) => ({ key, name }));
}

function named(names: readonly string[]): MemberCoverageParams["skills"] {
  return names.map((name, index) => ({ key: `s${index + 1}`, name }));
}

const FATIHAH_INDEX = QURAN_MEMORIZATION_SKILLS.findIndex(([key]) => key === "memorize-al-fatihah");

/** The same skills taught from Al-Fatihah and Al-Baqarah forward. */
const QURAN_FORWARD = [
  ...QURAN_MEMORIZATION_SKILLS.slice(0, FATIHAH_INDEX + 1),
  ...QURAN_MEMORIZATION_SKILLS.slice(FATIHAH_INDEX + 1).toReversed(),
];

export const TEST_CASES: MemberCoverageTestCase[] = [
  {
    expected: { size: 114, uncovered: [16] },
    id: "en-quran-memorization-drops-an-nahl",
    origin: "production",
    userInput: {
      goal: "Memorize the Quran",
      language: "en",
      skills: toSkills(QURAN_MEMORIZATION_SKILLS),
    },
  },
  {
    expected: { size: 114, uncovered: [16] },
    id: "en-quran-forward-drops-an-nahl",
    userInput: { goal: "Memorize the Quran", language: "en", skills: toSkills(QURAN_FORWARD) },
  },
  {
    expected: { size: 66, uncovered: [] },
    id: "en-bible-books-covered-by-ranges",
    origin: "production",
    userInput: {
      goal: "Master the ESV Bible",
      language: "en",
      skills: toSkills(BIBLE_BOOKS_SKILLS),
    },
  },
  {
    expected: { size: 118, uncovered: [] },
    id: "en-periodic-table-taught-by-period",
    userInput: {
      goal: "Learn every element of the periodic table",
      language: "en",
      skills: named([
        "Read the periodic table",
        "Name the period 1 elements",
        "Name the period 2 elements",
        "Name the period 3 elements",
        "Name the period 4 elements",
        "Name the period 5 elements",
        "Name the period 6 elements",
        "Name the period 7 elements",
        "Review all 118 elements",
      ]),
    },
  },
  {
    expected: { size: 12, uncovered: [6] },
    id: "pt-cranial-nerves-drops-abducens",
    userInput: {
      goal: "Aprender os doze pares de nervos cranianos",
      language: "pt",
      skills: named([
        "Identificar o nervo olfatório",
        "Identificar o nervo óptico",
        "Identificar o nervo oculomotor",
        "Identificar o nervo troclear",
        "Identificar o nervo trigêmeo",
        "Identificar o nervo facial",
        "Identificar o nervo vestibulococlear",
        "Identificar o nervo glossofaríngeo",
        "Identificar o nervo vago",
        "Identificar o nervo acessório",
        "Identificar o nervo hipoglosso",
        "Testar os nervos cranianos no exame físico",
      ]),
    },
  },
  {
    expected: { set: null },
    id: "en-largest-states-selection",
    userInput: {
      goal: "Learn the 10 largest US states by area",
      language: "en",
      skills: named([
        "Locate Alaska",
        "Locate Texas",
        "Locate California",
        "Locate Montana",
        "Locate New Mexico",
        "Locate Arizona",
        "Locate Nevada",
        "Locate Colorado",
        "Locate Wyoming",
      ]),
    },
  },
  {
    expected: { set: null },
    id: "en-statistics-ordinary-goal",
    userInput: {
      goal: "Learn statistics for data analysis",
      language: "en",
      skills: named([
        "Describe the center of a dataset",
        "Measure the spread of a dataset",
        "Test a hypothesis",
        "Fit a linear regression",
      ]),
    },
  },
  {
    expected: { set: null },
    id: "en-joyo-kanji-too-long",
    userInput: {
      goal: "Learn all 2,136 jōyō kanji",
      language: "en",
      skills: named([
        "Write kanji in stroke order",
        "Read the grade 1 kanji",
        "Read the grade 2 kanji",
        "Read the grade 3 kanji",
        "Read the grade 4 kanji",
        "Read the secondary school kanji",
      ]),
    },
  },
];
