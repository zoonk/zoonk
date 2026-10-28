import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import {
  type ActivityContentFor,
  type ActivityStepContent,
  type ActivityTemplateId,
} from "@zoonk/core/library/activities/templates";
import { type ComponentType } from "react";

export type ActivityPhase = "answering" | "checked" | "explore";

export type ActivityExpected =
  | { kind: "choice"; optionId: string }
  | { kind: "interaction"; answer: ActivityExpectedAnswer }
  | { kind: "numeric"; value: number };

type ActivityRendererSharedProps = {
  /** Controlled by the player reducer; renderers must not own a second answer state. */
  answer: ActivityAnswer | null;
  expected: ActivityExpected | null;
  labelId: string;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
};

/** Render only the canvas; ActivityStep owns the prompt, check, data note and feedback. */
export type ActivityRendererProps<TId extends ActivityTemplateId> = ActivityRendererSharedProps & {
  content: ActivityContentFor<TId>;
};

export type ActivityRenderer<TId extends ActivityTemplateId> = ComponentType<
  ActivityRendererProps<TId>
>;

export type AnyActivityRendererProps = ActivityRendererSharedProps & {
  content: ActivityStepContent;
};

export type ActivityStepProps = {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  picture: React.ReactNode;
  isCorrect: boolean | null;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: Exclude<ActivityPhase, "explore">;
};
