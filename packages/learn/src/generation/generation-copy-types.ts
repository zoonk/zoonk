import { type NumberedLines } from "./_utils/detail-line";
import { type GenerationKind, type GenerationPhase } from "./generation-kinds";

export type PhaseCopy = {
  label: string;
  /** What the phase is doing, in order while it runs. */
  lines: readonly string[];
  numbered?: NumberedLines;
};

export type KindCopy<TKind extends GenerationKind> = {
  /** What is being made: the progress bar's accessible name. */
  name: string;
  phases: Record<GenerationPhase<TKind>, PhaseCopy>;
};
