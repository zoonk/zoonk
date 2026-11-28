import { type TestCase } from "@/lib/types";
import { LESSON_IDS, publishedLesson } from "../lesson-activity-plan/published-lessons";

/** A published lesson and the screens its revised plan makes activities, as the planner briefs them. */
export type LessonActivitiesInput = {
  lessonId: string;
  activities: { activityTemplate: string; brief: string; screen: number }[];
};

function lessonCase({
  activities,
  expectations,
  id,
  lessonId,
}: LessonActivitiesInput & { expectations: string; id: string }): TestCase<
  undefined,
  LessonActivitiesInput
> {
  return {
    expectations,
    id,
    language: publishedLesson(lessonId).language,
    origin: "production",
    userInput: { activities, lessonId },
  };
}

export const TEST_CASES = [
  lessonCase({
    activities: [
      {
        activityTemplate: "codeRunner",
        brief:
          "In Python, the learner fixes line 1, `result = 15 // 2 - 8`, which drops the decimal part and prints `-1`, so it divides with the slash that keeps it; line 2 prints `result`, which is `-0.5` once it's right. Reversing the subtraction, `8 - 15 / 2`, prints `0.5`.",
        screen: 8,
      },
    ],
    expectations:
      "A Python codeRunner whose editable line is the division, uses the lesson's `15 / 2 - 8`, prints -0.5 only when the slash keeps the decimal part, and gives feedback for -1 and 0.5. The prompt says what the program should do without giving the output.",
    id: "python-numeric-practice",
    lessonId: LESSON_IDS.numericExpressions,
  }),
  lessonCase({
    activities: [
      {
        activityTemplate: "codeRunner",
        brief:
          "Hannah and two roommates in Richmond order four $7 meals on DoorDash, with a $2 delivery fee and a $6 coupon off the whole order, split three ways. The learner writes line 1, `share = ...`, the expression for each share, so `print(share)` prints `8.0`; `4 * 7 + 2 - 6 / 3` prints `28.0`, dividing only the coupon.",
        screen: 13,
      },
    ],
    expectations:
      "The application becomes a Python codeRunner in the DoorDash situation where the learner writes the whole expression with parentheses; only `(4 * 7 + 2 - 6) / 3` and equivalents print 8.0, and the version without parentheses prints something else with its own feedback.",
    id: "python-numeric-application",
    lessonId: LESSON_IDS.numericExpressions,
  }),
  lessonCase({
    activities: [
      {
        activityTemplate: "codeTracer",
        brief:
          "Trace a standard binary search for 17 in [5, 17, 26, 38, 44, 59] in Python, watching `inicio`, `fim` and `meio`. Pauses ask for `meio` at each round: 2, then 0, then 1. The tempting wrong option on the second round is 1, from rounding the middle up.",
        screen: 9,
      },
    ],
    expectations:
      "A codeTracer of the lesson's binary search with its variable names, whose trace matches a real run, pausing at each middle position with the rounding-up mistake among the options. Portuguese text.",
    id: "binary-search-tracer",
    lessonId: LESSON_IDS.binarySearch,
  }),
  lessonCase({
    activities: [
      {
        activityTemplate: "codeRunner",
        brief:
          "In JavaScript, the chain `Promise.reject('falha')`, then a step that should recover with 4, then `.then(n => console.log(n + 1))`, then `console.log('segue')` on its own line. The learner fixes line 2, written as `.then(() => 4)`, so the chain recovers from the rejection; once right the program prints `segue` and then `5`.",
        screen: 12,
      },
    ],
    expectations:
      "A JavaScript codeRunner whose edited line is the recovering step, printing `segue` then `5` only when the chain catches the rejection; the starter's output (an unhandled rejection or only `segue`) differs and has feedback. Portuguese text.",
    id: "javascript-promises",
    lessonId: LESSON_IDS.promises,
  }),
];
