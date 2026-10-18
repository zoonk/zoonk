import {
  type LessonPlayerAnswer,
  type LessonStepResult,
  type PlayableLibraryStep,
} from "../lesson-player-types";

/** What every screen view receives: the step, its answer and verdict, and how to answer. */
export type LessonStepViewProps<TStep extends PlayableLibraryStep = PlayableLibraryStep> = {
  answer: LessonPlayerAnswer | undefined;
  /** The answer is being graded or was graded: inputs are read-only. */
  isLocked: boolean;
  onAnswer: (answer: LessonPlayerAnswer | null) => void;
  result: LessonStepResult | undefined;
  step: TStep;
};

export type StepOf<TKind extends PlayableLibraryStep["kind"]> = Extract<
  PlayableLibraryStep,
  { kind: TKind }
>;
