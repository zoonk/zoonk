import {
  type LessonPlayerAnswer,
  type LessonStepResult,
  type PlayableLibraryStep,
} from "../lesson-player-types";

export type LessonStepViewProps<TStep extends PlayableLibraryStep = PlayableLibraryStep> = {
  answer: LessonPlayerAnswer | undefined;
  isLocked: boolean;
  onAnswer: (answer: LessonPlayerAnswer | null) => void;
  result: LessonStepResult | undefined;
  step: TStep;
};

export type StepOf<TKind extends PlayableLibraryStep["kind"]> = Extract<
  PlayableLibraryStep,
  { kind: TKind }
>;
