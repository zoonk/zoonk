import { type TestCase } from "@/lib/types";
import { LESSON_IDS, publishedLesson } from "./published-lessons";

/** Lesson ids are keys of `published-lessons.json`; the task adds the template catalog. */
export type LessonActivityPlanInput = { lessonId: string };

export type LessonActivityPlanExpected = {
  /** Screens (from 1) that must become an activity. */
  mustChange?: number[];
  /** Whether at least one screen changes; omitted when either is fine. */
  changes?: boolean;
  /** Templates a changed screen may use; omitted when any fits. */
  templates?: string[];
  forbiddenTemplates?: string[];
};

const CODE_TEMPLATES = ["codeRunner", "codeTracer", "sqlPlayground"];

function lessonCase({
  expectations,
  expected,
  id,
  lessonId,
}: {
  expectations: string;
  expected: LessonActivityPlanExpected;
  id: string;
  lessonId: string;
}): TestCase<LessonActivityPlanExpected, LessonActivityPlanInput> {
  return {
    expectations,
    expected,
    id,
    language: publishedLesson(lessonId).language,
    origin: "production",
    userInput: { lessonId },
  };
}

export const TEST_CASES = [
  lessonCase({
    expectations:
      "The practice right after the first worked example (screen 8, which covers both skills) becomes a Python codeRunner where the learner writes or fixes the expression the check asked about; screen 12 practises a skill screen 8 already did, so it may stay a check. The application can become one where they write the split-the-bill expression. Each brief names the line to edit, the output only the right edit prints, and the tempting mistake's output.",
    expected: { mustChange: [8], templates: ["codeRunner", "codeTracer"] },
    id: "python-numeric-expressions",
    lessonId: LESSON_IDS.numericExpressions,
  }),
  lessonCase({
    expectations:
      "A Python values lesson practises on programs: at least one check becomes a codeRunner (or codeTracer) on the values the lesson taught. The existing categorize screen stays.",
    expected: { changes: true, templates: ["codeRunner", "codeTracer"] },
    id: "python-values",
    lessonId: LESSON_IDS.pythonValues,
  }),
  lessonCase({
    expectations:
      "The practice right after the worked binary search (screen 9, which positions it examines) becomes a codeTracer of that search in a language the tracer runs, asking for the middle position at each round, with the round-the-middle-up mistake as a wrong option. The application, a choice between data structures, stays a check.",
    expected: { mustChange: [9], templates: ["codeTracer", "codeRunner"] },
    id: "binary-search-tracer",
    lessonId: LESSON_IDS.binarySearch,
  }),
  lessonCase({
    expectations:
      "The practice after the worked promise chain (screen 12) becomes a JavaScript activity: a codeRunner where the learner fixes the chain so it recovers and prints the expected lines, or a codeTracer of the order the lines print.",
    expected: { mustChange: [12], templates: ["codeRunner", "codeTracer"] },
    id: "javascript-promises",
    lessonId: LESSON_IDS.promises,
  }),
  lessonCase({
    expectations:
      "C++ doesn't run in the code runner or the code tracer, so neither is planned. Checks may stay checks; a findError on a worked answer is fine.",
    expected: { forbiddenTemplates: CODE_TEMPLATES },
    id: "cpp-no-runner",
    lessonId: LESSON_IDS.cppStructure,
  }),
  lessonCase({
    expectations:
      "Selecting and changing DOM elements needs a browser page the code runner doesn't have, so no codeRunner or codeTracer runs DOM code. Leaving the lesson as it is is right.",
    expected: { forbiddenTemplates: ["codeRunner", "codeTracer"] },
    id: "dom-no-runner",
    lessonId: LESSON_IDS.domSelection,
  }),
  lessonCase({
    expectations:
      "A law lesson about the right to public information is about ideas, not doing: no screen changes.",
    expected: { changes: false },
    id: "law-no-activity",
    lessonId: LESSON_IDS.informationAccessLaw,
  }),
  lessonCase({
    expectations:
      "Logical equivalences are judged, not produced in a template: no code templates, and no sort into equivalent or not equivalent (that's true-or-false judgments). Leaving it as it is is right.",
    expected: { forbiddenTemplates: [...CODE_TEMPLATES, "categorize"] },
    id: "de-morgan",
    lessonId: LESSON_IDS.deMorgan,
  }),
  lessonCase({
    expectations:
      "The checks ask whether a given value solves an equation in context, which is verifying, not producing a solution, so they stay checks. Never code.",
    expected: { forbiddenTemplates: [...CODE_TEMPLATES, "stepSolver", "balance"] },
    id: "math-solutions-in-context",
    lessonId: LESSON_IDS.solutionsInContext,
  }),
  lessonCase({
    expectations:
      "Recording money in and out: no code. An activity only where the learner produces what a template grades (such as a running balance in a formulaModel); otherwise no change.",
    expected: { forbiddenTemplates: CODE_TEMPLATES },
    id: "money-records",
    lessonId: LESSON_IDS.moneyRecords,
  }),
  lessonCase({
    expectations:
      "Reverse complements are a rule applied by hand in this lesson. A codeRunner only if the course has taught code, which it hasn't here; a processOrder or matchPairs only where the move is the check's own. Any change keeps the lesson's sequences.",
    expected: {},
    id: "dna-reverse-complement",
    lessonId: LESSON_IDS.dnaStrands,
  }),
];
