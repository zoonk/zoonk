import { type NumberedLines } from "./_utils/detail-line";
import { type GenerationKind, type GenerationPhase } from "./generation-kinds";

export type PhaseCopy = { label: string; lines: readonly string[]; numbered?: NumberedLines };

export type KindCopy<TKind extends GenerationKind> = {
  name: string;
  phases: Record<GenerationPhase<TKind>, PhaseCopy>;
};
