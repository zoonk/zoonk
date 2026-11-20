import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskScorer } from "@/lib/types";
import {
  type CourseDetails,
  PAGE_LIST_ITEMS,
  SUBJECT_CATEGORIES,
} from "@zoonk/ai/tasks/courses/details";

export type CourseDetailsExpected = { categories?: string[] };

const MAX_CATEGORIES = 2;

type ListField = keyof typeof PAGE_LIST_ITEMS;

function parseDetails(output: string): CourseDetails | null {
  try {
    return JSON.parse(output) as CourseDetails;
  } catch {
    return null;
  }
}

function checkList({ details, field }: { details: CourseDetails; field: ListField }): string[] {
  const items = PAGE_LIST_ITEMS[field];
  const list = details.landingPage[field];

  return list.length === items ? [] : [`${field} has ${list.length} items; it needs ${items}.`];
}

function checkCategories({
  details,
  expected,
}: {
  details: CourseDetails;
  expected?: CourseDetailsExpected;
}): string[] {
  const { categories } = details;
  const accepted = expected?.categories;

  const invalid = categories.filter((category) => !SUBJECT_CATEGORIES.includes(category));

  return [
    (categories.length === 0 || categories.length > MAX_CATEGORIES) &&
      `The course has ${categories.length} categories; it needs 1 or 2.`,
    invalid.length > 0 && `Categories outside the allowed list: ${invalid.join(", ")}.`,
    accepted &&
      !categories.some((category) => accepted.includes(category)) &&
      `None of the categories (${categories.join(", ")}) is a primary domain for this course (${accepted.join(", ")}).`,
  ].filter((problem) => typeof problem === "string");
}

function checkText(details: CourseDetails): string[] {
  const { description, landingPage } = details;
  const allText = JSON.stringify(details);

  return [
    !description.trim() && "The description is missing.",
    !landingPage.valueProposition.trim() && "The promise (valueProposition) is missing.",
    allText.includes("—") && "The copy uses an em dash.",
  ].filter((problem) => typeof problem === "string");
}

function checkCourseDetails({
  expected,
  output,
}: {
  expected?: CourseDetailsExpected;
  output: string;
}): CodeCheckResult {
  const details = parseDetails(output);

  if (!details) {
    return { judgedOutput: output, passed: 0, problems: ["The output isn't JSON."], total: 1 };
  }

  const checks = [
    checkText(details),
    ...(["audience", "outcomes"] as const).map((field) => checkList({ details, field })),
    expected?.categories ? checkCategories({ details, expected }) : [],
  ];

  return {
    judgedOutput: output,
    passed: checks.filter((problems) => problems.length === 0).length,
    problems: checks.flat(),
    total: checks.length,
  };
}

export const COURSE_DETAILS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Check whether the copy fits this course: the description says what the subject is and what the course covers, naming real parts of the subject that the CHAPTERS and the course title imply, and describes the whole course rather than only the chapters written so far. Outcomes are concrete, observable abilities a learner of this course would build, in order from what the learner does first to the furthest the course goes; four short outcomes can't name every chapter, so judge whether together they show the course's range. Notice generic education copy that would fit any course, outcomes that are topics instead of abilities, and claims about content the course clearly doesn't cover. A description or outcomes that could belong to any course tell the visitor nothing about this one.`,
    id: "fit",
    label: "Fit and specificity",
    weight: 30,
  },
  {
    expectations: `Check honesty. Nothing promises a pass, score, admission, certificate, license, job, salary or fluency by a date; nothing mentions duration, prices or access rules; no inflated claims ("master", "become an expert", "everything you need"). For regulated professions (medicine, nursing, law, finance and the like), no field implies the course qualifies someone to practice, diagnose, treat, prescribe, represent clients or give professional advice: it frames study, understanding or working with professionals. Hobbies and pop culture get personal, creative and cultural uses, not careers. A promise of a result, or a practice claim in a regulated field, misleads the visitor; one inflated claim or a career framing on a hobby is a smaller cost.`,
    id: "honesty",
    label: "Honest claims",
    weight: 25,
  },
  {
    expectations: `Check the promise (\`landingPage.valueProposition\`, the first line under the course's name) and the outcomes (the page's "What you'll be able to do") as a visitor from a search reads them at the course's starting level. The course title and the first band of CHAPTERS set that level: a "from scratch" title or an overview or beginner band means someone who has never studied the subject; a title naming an advanced or professional level means someone who already uses the field's common terms. The promise is one short sentence that opens with what the learner will be able to do, a concrete result they'd recognize from everyday life, work, study or the exam, not the subject's definition, the course's process, a list of topics or an opener like "You'll be able to" or "Você poderá" before the result. The promise and every outcome use words that visitor already knows: a term the course teaches (an equation, a model, a named law, field jargon) appears only as what it lets the learner do. Notice abstract verbs and nouns ("apply models", "relate concepts", "analyze processes", "assessed criteria") where a concrete action fits; "understand" and its equivalents count as abstract in the promise and the outcomes, unless understanding is the ability itself (a language learner following what they hear or read). Terms the course's audience already uses and the subject's own name are fine, and vagueness is no virtue: plain words still say something specific. Each outcome is one action a visitor takes in at a glance, a natural phrase rather than a clipped note: notice an outcome that strings together a list of topics or tools, or adds a clause on how or why. A promise that's technical or abstract for the course's level loses the visitor at the first line; a plain promise that doesn't open with the result, outcomes in words the visitor wouldn't know, a stiff, wordy promise, and outcomes that are lists or read clipped are smaller costs. Check the mood too: in Portuguese, Spanish, French and Italian the promise and outcomes start with the infinitive ("Explicar por que…"), in Polish too (imperfective for a skill), in German they're infinitive phrases with the verb last, in Turkish verb-final phrases ending in the -mak/-mek infinitive, in Japanese phrases ending in the plain potential form (読める, ～できる), in Korean phrases ending in ~ㄹ 수 있어요, and English uses the base form ("Explain why…"). An imperative aimed at the visitor ("Explique…", "Resolva…", "Erkläre…", "Risolvi…", "解きましょう", "풀어 보세요") reads as an exam instruction, not an ability they'll have.`,
    id: "promise",
    label: "Plain, outcome-first promise",
    weight: 20,
  },
  {
    expectations: `Check the audience (the page's "Who it's for"). Each item is a short label a visitor recognizes themselves in at a glance (a role, a situation or what they're curious about), each a different kind of person, not a sentence about what they'll do in the course and not a label like "anyone interested". Language courses focus on communicating in real situations, travel, study, work and culture. Vague labels, items describing the same kind of person, and items that read as sentences don't let a visitor find themselves.`,
    id: "audience",
    label: "Audience",
    weight: 10,
  },
  {
    expectations: `Check the language and style. Every field is in the requested language variant (US English, Brazilian Portuguese), including audience nouns, with natural phrasing rather than translation; plain words in the description and the audience (the promise and outcomes are judged on their own); no "learn", "explore", "introduction to", "basics of" or their equivalents; no hype. "Understand" and its equivalents are allowed in the audience and the description, and judged only under the promise, so they're fine here. Fields in the wrong language are fields the visitor can't read; a few stiff, jargon-heavy or banned phrasings are a smaller cost.`,
    id: "language",
    label: "Language and style",
    weight: 15,
  },
]);

export const scoreCourseDetails: TaskScorer<CourseDetailsExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkCourseDetails({ expected: testCase.expected, output: value }),
    output,
    scoreCategories: COURSE_DETAILS_SCORE_CATEGORIES,
    testCase,
  });
