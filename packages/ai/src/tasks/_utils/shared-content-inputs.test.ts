import { describe, expectTypeOf, it } from "vitest";
import { type ChallengeCaseParams } from "../challenge/challenge-case";
import { type CourseDetailsParams } from "../courses/course-details";
import { type CourseOutlineParams } from "../curriculum/course-outline";
import { type QuickExplanationParams } from "../explain/quick-explanation";
import { type ExplainWrongAnswerParams } from "../grading/explain-wrong-answer";
import { type GenerateItemsParams } from "../items/generate-items";
import { type PlacementItemsParams } from "../items/placement-items";
import { type WriteItemSetParams } from "../items/write-item-set";
import { type LessonSpecParams } from "../lesson-spec/lesson-spec";
import { type LessonWritingContext } from "../lesson-writer/format-lesson-plan";
import { type GenerateStepVariantParams } from "../variants/step-variant";
import { type WriteWarmUpCardsParams } from "../warm-up/write-warm-up-cards";

/** What only one learner told us; shared content is read by every learner of its country. */
type PersonalField =
  | "facts"
  | "homeCountry"
  | "learnerHomeCountry"
  | "learnerMemory"
  | "learnerNames"
  | "timeZone";

type SharedContentParams =
  | ChallengeCaseParams
  | CourseDetailsParams
  | CourseOutlineParams
  | ExplainWrongAnswerParams
  | GenerateItemsParams
  | GenerateStepVariantParams
  | LessonSpecParams
  | LessonWritingContext
  | PlacementItemsParams
  | QuickExplanationParams
  | WriteItemSetParams
  | WriteWarmUpCardsParams;

type PersonalFieldsOf<Params> = Params extends unknown
  ? Extract<keyof Params, PersonalField>
  : never;

describe("shared-content task inputs", () => {
  it("set content in its own country, never in where a learner lives", () => {
    expectTypeOf<PersonalFieldsOf<SharedContentParams>>().toBeNever();
    expectTypeOf<SharedContentParams["country"]>().toEqualTypeOf<string | null>();
  });
});
