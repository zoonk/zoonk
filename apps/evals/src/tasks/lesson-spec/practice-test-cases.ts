import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/lesson-spec";
import { listPlannerTemplates } from "@zoonk/core/library/activities/writer-templates";
import { type LessonSpecExpected } from "./visual-test-cases";

const ACTIVITY_TEMPLATES: LessonSpecParams["activityTemplates"] = listPlannerTemplates();

const PRACTICE_EXPECTATIONS = `
  - The skill is something the learner does, so practice lets them do it: the practice right after a worked example, or the application, is the activity whose template grades what the learner produces, and checks keep recall in a situation, judging statements, deciding and spotting a mistake
  - Doing the skill takes the place of a check, never screens on top of a full plan: the plan stays about 3 minutes and within 5 to 16 screens, with no activity that only decorates
  - The output is a list of lesson specs (usually one; several only when the lesson had to be split): skills, and screens with a kind, skill indexes, a brief for the writer, an optional visual and an activity template id where the plan names one
  - Estimated minutes are computed by code from the screen kinds; don't grade the number itself
  - Don't evaluate JSON formatting
`;

type PracticeCase = TestCase<LessonSpecExpected, OptionalCountry<LessonSpecParams>>;

function practiceCase({
  expectations,
  expected,
  id,
  origin,
  ...input
}: Omit<OptionalCountry<LessonSpecParams>, "activityTemplates"> &
  Pick<PracticeCase, "expected" | "origin"> & { expectations: string; id: string }): PracticeCase {
  return {
    expectations: `${expectations}\n${PRACTICE_EXPECTATIONS}`,
    expected,
    id: `practice-${id}`,
    origin,
    userInput: { activityTemplates: ACTIVITY_TEMPLATES, ...input },
  };
}

const PYTHON_CHAPTER = {
  chapterTitle: "Simple Python programs",
  courseTitle: "Python",
  language: "en",
  level: "beginner",
} as const;

export const PRACTICE_TEST_CASES: PracticeCase[] = [
  practiceCase({
    ...PYTHON_CHAPTER,
    chapterLessons: [
      {
        canDo: "Distinguish numbers, text, and Boolean values in Python.",
        order: "after",
        title: "Python values and types",
      },
      {
        canDo: "Use input and convert it to a number.",
        order: "after",
        title: "Python input and type conversion",
      },
      {
        canDo: "Find and fix a simple error in a Python program.",
        order: "after",
        title: "Python errors and testing",
      },
    ],
    expectations: `
      - MUST be in US English
      - A practice screen lets the learner write or fix a \`print\` line in a codeRunner, and the app checks what the program prints: its brief names the editable line (a message missing, misspelled or in the wrong order) and the exact output once it's right
      - A regression to avoid (production, 26 Nov 2026): this lesson planned a codeRunner with "the same code as starter and solution, no editable lines", so the learner only pressed Run, and its application was a choice about ordering print statements. A codeRunner the learner only runs, or a starter that already equals its solution, is the regression
      - Ideally the application is that activity in a realistic situation: a short program for a real task (a sign, a check-in desk, a receipt) the learner completes so it prints what the task asks
    `,
    id: "en-python-statements",
    lessonCanDo: "Run a short Python program and predict its output.",
    lessonDescription:
      "A program uses executable statements to produce a result, such as printing a greeting.",
    lessonTitle: "Python programs and statements",
    origin: "production",
    skills: ["Predict program output", "Run a simple Python program"],
  }),
  practiceCase({
    ...PYTHON_CHAPTER,
    chapterLessons: [
      {
        canDo: "Run a short Python program and predict its output.",
        order: "before",
        title: "Python programs and statements",
      },
      {
        canDo: "Use input and convert it to a number.",
        order: "after",
        title: "Python input and type conversion",
      },
      {
        canDo: "Find and fix a simple error in a Python program.",
        order: "after",
        title: "Python errors and testing",
      },
    ],
    expectations: `
      - MUST be in US English
      - Learners work with real Python, not only questions about it: a codeRunner where they fix a value's type on a named line (text "5" where a number belongs, so the program prints 55 instead of 10) and the app checks the printed output, or a codeTracer where they predict a value or its type as the program runs
      - A regression to avoid (production, issue report 20 Nov 2026): a lesson on Python values was nine screens of guessing, choosing and sorting, and the learner never wrote or ran a line of code
      - Checks can still ask which type a value has or what an expression gives, with tempting answers learners really pick ("5" is a number, True in quotes is a Boolean)
    `,
    id: "en-python-values",
    lessonCanDo: "Distinguish numbers, text, and Boolean values in Python.",
    lessonDescription: "Python values have types that determine how they behave in a program.",
    lessonTitle: "Python values and types",
    origin: "production",
    skills: ["Identify Python value types"],
  }),
  practiceCase({
    chapterLessons: [
      {
        canDo: "Print a message from a C++ program.",
        order: "after",
        title: "C++ standard output",
      },
      {
        canDo: "Store and display an integer in a variable.",
        order: "after",
        title: "C++ variables",
      },
      {
        canDo: "Choose a suitable type for a simple value.",
        order: "after",
        title: "C++ data types",
      },
    ],
    chapterTitle: "Simple C++ programs",
    courseTitle: "C++ Programming",
    expectations: `
      - MUST be in US English
      - The app can't run C++, so no codeRunner or codeTracer. Practice still uses real C++ code: predicting what a program does or reports in checks, finding the wrong line in a worked answer (findError), or ordering a minimal program's lines (processOrder) only when they have exactly one valid order
      - A regression to avoid (production, 26 Nov 2026): a 13-screen plan of only explanations and choice checks about \`int main() { return 0; }\`, with an explanation for each symbol (the braces, the parentheses, \`int\`, the semicolon). One screen per symbol, with nothing the learner does with the program, is the regression
    `,
    expected: { avoidTemplates: ["codeRunner", "codeTracer"] },
    id: "en-cpp-structure",
    language: "en",
    lessonCanDo: "Identify main and recognize successful completion in a minimal C++ program.",
    lessonDescription:
      "A minimal C++ program uses a main function as its starting point and returns a status when it finishes.",
    lessonTitle: "C++ program structure",
    level: "beginner",
    origin: "production",
    skills: ["Recognize the structure of a C++ program"],
  }),
  practiceCase({
    chapterLessons: [
      { order: "before", title: "Variáveis e console.log" },
      { order: "before", title: "Decisões com if" },
      { order: "after", title: "O laço while" },
      { order: "after", title: "Percorrendo arrays" },
    ],
    chapterTitle: "Repetição",
    courseTitle: "JavaScript",
    expectations: `
      - MUST be in Brazilian Portuguese
      - Writing a loop is a procedure, so a worked example comes first; the practice right after it lets the learner write or fix the \`for\` line (its start, condition or step) in a codeRunner, and the app checks what the program prints: its brief names the line to write and the exact output once it's right
      - Ideally the application is a codeRunner in a realistic task (a countdown, the numbers of a queue's tickets, a table of a few prices) whose brief names the line the learner writes and what the program prints when it's right; never a program the learner only runs
      - Checks keep the classic off-by-one trap: \`<=\` against \`<\` printing one number too many or too few
    `,
    id: "pt-javascript-for",
    language: "pt",
    lessonCanDo: "Escrever um laço for que repete uma ação um número certo de vezes",
    lessonDescription:
      "Como o laço for repete um bloco de código contando de um valor a outro, e como escolher onde ele começa e para.",
    lessonTitle: "O laço for",
    level: "beginner",
    skills: ["Escrever um laço for com início, condição e passo"],
  }),
];
