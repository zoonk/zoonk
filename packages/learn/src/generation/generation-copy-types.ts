import { type GenerationKind, type GenerationPhase } from "./generation-kinds";

export type KindCopy<TKind extends GenerationKind> = {
  name: string;
  phases: Record<GenerationPhase<TKind>, string>;
};
