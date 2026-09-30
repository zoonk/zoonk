import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskScorer } from "@/lib/types";
import { type CourseDetails } from "@zoonk/ai/tasks/v2/courses/details";
import { isValidCategory } from "@zoonk/utils/categories";

/**
 * The categories a course may be listed under first: the model passes when one of its
 * categories is one of these. Language courses get theirs from their target language, so their
 * cases leave it out.
 */
export type CourseDetailsExpected = { categories?: string[] };

/** The page's limits, from the prompt: short enough to read at a glance. */
const MAX_DESCRIPTION_SENTENCES = 3;
const MAX_DESCRIPTION_LENGTH = 420;
const MAX_VALUE_LENGTH = 200;
const LIST_SIZES = { audience: [3, 5], outcomes: [4, 6] } as const;
const MAX_CATEGORIES = 2;

type ListField = keyof typeof LIST_SIZES;

const SENTENCE_END = /[.!?](?:\s|$)/gu;

function parseDetails(output: string): CourseDetails | null {
  try {
    return JSON.parse(output) as CourseDetails;
  } catch {
    return null;
  }
}

function countSentences(text: string): number {
  return text.match(SENTENCE_END)?.length ?? 0;
}

function checkList({ details, field }: { details: CourseDetails; field: ListField }) {
  const [min, max] = LIST_SIZES[field];
  const count = details.landingPage[field].length;

  return count >= min && count <= max
    ? null
    : `${field} has ${count} items; it needs ${min} to ${max}.`;
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

  const invalid = categories.filter(
    (category) => !isValidCategory(category) || category === "languages",
  );

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
  const sentences = countSentences(description);
  const allText = JSON.stringify(details);

  return [
    (sentences === 0 || sentences > MAX_DESCRIPTION_SENTENCES) &&
      `The description has ${sentences} sentences; it needs 1 to 3.`,
    description.length > MAX_DESCRIPTION_LENGTH &&
      `The description is ${description.length} characters; keep it under ${MAX_DESCRIPTION_LENGTH}.`,
    (!landingPage.valueProposition || landingPage.valueProposition.length > MAX_VALUE_LENGTH) &&
      "The value proposition is missing or longer than one short sentence.",
    allText.includes("—") && "The copy uses an em dash.",
  ].filter((problem) => typeof problem === "string");
}

/**
 * The parts the page relies on: the description's length, the value proposition, each list's
 * size, the categories (valid, one or two, and a primary domain) and no em dashes. The judge sees
 * the whole output; code checks carry their own share of the score.
 */
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
    ...(["audience", "outcomes"] as const).map((field) =>
      [checkList({ details, field })].filter((problem) => problem !== null),
    ),
    expected?.categories ? checkCategories({ details, expected }) : [],
  ];

  return {
    judgedOutput: output,
    passed: checks.filter((problems) => problems.length === 0).length,
    problems: checks.flat(),
    total: checks.length,
  };
}

const COURSE_DETAILS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether the copy fits this course: the description says what the subject is and what the course covers, naming real parts of the subject that the CHAPTERS and the course title imply, and describes the whole course rather than only the chapters written so far. Outcomes are concrete, observable abilities a learner of this course would build. Penalize generic education copy that would fit any course, outcomes that are topics instead of abilities, and claims about content the course clearly doesn't cover. Score at most 8 when two or more items are generic; at most 7 when the description or most outcomes could belong to any course.`,
    id: "fit",
    label: "Fit and specificity",
    weight: 35,
  },
  {
    expectations: `Audit honesty. Nothing promises a pass, score, admission, certificate, license, job, salary or fluency by a date; nothing mentions duration, prices or access rules; no inflated claims ("master", "become an expert", "everything you need"). For regulated professions (medicine, nursing, law, finance and the like), no field implies the course qualifies someone to practice, diagnose, treat, prescribe, represent clients or give professional advice: it frames study, understanding or working with professionals. Hobbies and pop culture get personal, creative and cultural uses, not careers. Score at most 6 for any promise of a result or a practice claim in a regulated field; at most 8 for one inflated claim or a career framing on a hobby.`,
    id: "honesty",
    label: "Honest claims",
    weight: 30,
  },
  {
    expectations: `Audit the audience. Audience items are specific fit statements a person recognizes (a role, a goal or a situation), not labels like "anyone interested". Language courses focus on communicating in real situations, travel, study, work and culture. Score at most 8 when two items are vague labels; at most 7 when most are.`,
    id: "audience",
    label: "Audience",
    weight: 15,
  },
  {
    expectations: `Audit the language and style. Every field is in the requested language variant (US English, Brazilian Portuguese), including audience nouns, with natural phrasing rather than translation; plain words a beginner understands; no "learn", "understand", "explore", "introduction to", "basics of" or their equivalents; no hype. Score at most 6 when fields are in the wrong language; at most 8 for a few stiff, jargon-heavy or banned phrasings.`,
    id: "language",
    label: "Language and style",
    weight: 20,
  },
]);

export const scoreCourseDetails: TaskScorer<CourseDetailsExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkCourseDetails({ expected: testCase.expected, output: value }),
    output,
    scoreCategories: COURSE_DETAILS_SCORE_CATEGORIES,
    testCase,
  });
