import { getDistractorWords } from "@zoonk/core/player/distractor-words";
import {
  type MultipleChoiceStepContent,
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import {
  type SupportedVisualKind,
  type VisualContentByKind,
  isSupportedVisualKind,
  parseVisualContent,
} from "@zoonk/core/steps/visual-content-contract";
import { shuffle } from "@zoonk/utils/shuffle";
import { type ActivityWithSteps } from "./get-activity";
import { type LessonSentenceData } from "./get-lesson-sentences";
import { type LessonWordData } from "./get-lesson-words";

const VOCABULARY_DISTRACTOR_COUNT = 3;

export type SerializedWord = {
  id: string;
  word: string;
  translation: string;
  alternativeTranslations: string[];
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
  vocabularyOptions: SerializedWord[];
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

function serializeWord(
  word: NonNullable<ActivityWithSteps["steps"][number]["word"]>,
): SerializedWord {
  return {
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.audioUrl,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  };
}

function serializeSentence(
  sentence: NonNullable<ActivityWithSteps["steps"][number]["sentence"]>,
): SerializedSentence {
  return {
    audioUrl: sentence.audioUrl,
    id: String(sentence.id),
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: sentence.translation,
  };
}

function parseVisualIfSupported(
  visualKind: string | null,
  visualContent: unknown,
): { kind: SupportedVisualKind; content: SerializedStep["visualContent"] } | null {
  if (!visualKind || !visualContent) {
    return null;
  }

  if (!isSupportedVisualKind(visualKind)) {
    return null;
  }

  try {
    return {
      content: parseVisualContent(visualKind, visualContent),
      kind: visualKind,
    };
  } catch {
    return null;
  }
}

function shuffleMultipleChoiceContent(
  content: MultipleChoiceStepContent,
): MultipleChoiceStepContent {
  switch (content.kind) {
    case "core":
      return { ...content, options: shuffle(content.options) };
    case "challenge":
      return { ...content, options: shuffle(content.options) };
    case "language":
      return { ...content, options: shuffle(content.options) };
    default:
      return content;
  }
}

function buildVocabularyOptions(
  step: SerializedStep,
  serializedLessonWords: SerializedWord[],
): SerializedWord[] {
  if (step.kind !== "vocabulary" || !step.word) {
    return [];
  }

  const distractors = getDistractorWords(
    step.word,
    serializedLessonWords,
    VOCABULARY_DISTRACTOR_COUNT,
  );
  return shuffle([step.word, ...distractors]).map((word) => ({
    ...word,
    alternativeTranslations: [...word.alternativeTranslations],
  }));
}

function serializeStep(step: ActivityWithSteps["steps"][number]): SerializedStep | null {
  if (!isSupportedStepKind(step.kind)) {
    return null;
  }

  try {
    const content =
      step.kind === "multipleChoice"
        ? shuffleMultipleChoiceContent(parseStepContent("multipleChoice", step.content))
        : parseStepContent(step.kind, step.content);

    const visual = parseVisualIfSupported(step.visualKind, step.visualContent);

    return {
      content,
      id: String(step.id),
      kind: step.kind,
      position: step.position,
      sentence: step.sentence ? serializeSentence(step.sentence) : null,
      visualContent: visual?.content ?? null,
      visualKind: visual?.kind ?? null,
      vocabularyOptions: [],
      word: step.word ? serializeWord(step.word) : null,
    };
  } catch {
    return null;
  }
}

export function prepareActivityData(
  activity: ActivityWithSteps,
  lessonWords: LessonWordData[],
  lessonSentences: LessonSentenceData[],
): SerializedActivity {
  const serializedLessonWords = lessonWords.map((word) => ({
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.audioUrl,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  }));

  const steps = activity.steps
    .map((step) => serializeStep(step))
    .filter((step): step is SerializedStep => step !== null)
    .map((step) => ({
      ...step,
      vocabularyOptions: buildVocabularyOptions(step, serializedLessonWords),
    }));

  return {
    description: activity.description,
    id: String(activity.id),
    kind: activity.kind,
    language: activity.language,
    lessonSentences: lessonSentences.map((sentence) => ({
      audioUrl: sentence.audioUrl,
      id: String(sentence.id),
      romanization: sentence.romanization,
      sentence: sentence.sentence,
      translation: sentence.translation,
    })),
    lessonWords: serializedLessonWords,
    organizationId: activity.organizationId,
    steps,
    title: activity.title,
  };
}
