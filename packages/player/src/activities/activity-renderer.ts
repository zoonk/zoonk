import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import {
  type ActivityContentFor,
  type ActivityStepContent,
  type ActivityTemplateId,
} from "@zoonk/core/library/activities/templates";
import { type ComponentType } from "react";

export type ActivityPhase = "answering" | "checked";

/**
 * What a correct answer looks like, for showing next to the learner's after the check. It comes
 * from the same values `checkActivityAnswer` grades with: the correct option, the check's answer
 * (which the validator recomputed before publishing) or the end state code computes from the
 * fields. Never from model-written text.
 */
export type ActivityExpected =
  | { kind: "choice"; optionId: string }
  | { kind: "interaction"; answer: ActivityExpectedAnswer }
  | { kind: "numeric"; value: number };

type ActivityRendererSharedProps = {
  /** The learner's answer. Controlled: it lives in the player reducer, never in the renderer. */
  answer: ActivityAnswer | null;
  /** Present once `phase` is "checked". */
  expected: ActivityExpected | null;
  /** Id of the prompt element, for `aria-labelledby` on the canvas. */
  labelId: string;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
};

/**
 * Props every template renderer receives. `content` is narrowed to the template, so
 * `content.fields` is typed. Renderers draw the canvas only: the prompt, the check area, the
 * data source and the feedback belong to `ActivityStep`.
 */
export type ActivityRendererProps<TId extends ActivityTemplateId> = ActivityRendererSharedProps & {
  content: ActivityContentFor<TId>;
};

export type ActivityRenderer<TId extends ActivityTemplateId> = ComponentType<
  ActivityRendererProps<TId>
>;

/** Props for a canvas that accepts any template's content, as the registry exposes them. */
export type AnyActivityRendererProps = ActivityRendererSharedProps & {
  content: ActivityStepContent;
};

export type ActivityStepProps = {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  /** The picture of the case (a decision tree's leaf), drawn, on its way or described. */
  picture: React.ReactNode;
  /** The server's grade once `phase` is "checked"; null while answering. */
  isCorrect: boolean | null;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
};
