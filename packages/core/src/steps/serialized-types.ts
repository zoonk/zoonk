import { type StepContentByKind, type SupportedStepKind } from "./content-contract";
import { type SupportedVisualKind, type VisualContentByKind } from "./visual-content-contract";

export type SerializedWord = {
  id: string;
  word: string;
  translation: string;
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedSentence = {
  id: string;
  sentence: string;
  translation: string;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedStep<Kind extends SupportedStepKind = SupportedStepKind> = {
  id: string;
  kind: Kind;
  position: number;
  content: StepContentByKind[Kind];
  visualKind: SupportedVisualKind | null;
  visualContent: VisualContentByKind[SupportedVisualKind] | null;
  word: SerializedWord | null;
  sentence: SerializedSentence | null;
};

export type SerializedActivity = {
  id: string;
  kind: string;
  title: string | null;
  description: string | null;
  language: string;
  organizationId: number;
  steps: SerializedStep[];
  lessonWords: SerializedWord[];
  lessonSentences: SerializedSentence[];
};
