/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import {
  type PlayableLanguageStep,
  type PlayableSpokenAnswerStep,
  type PlayableStepImage,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "@zoonk/core/lesson-player/contract";
import {
  type ChartVisual,
  type TimelineVisual,
  parseStepContent,
} from "@zoonk/core/library/steps/contract";
import { type ExerciseKind } from "@zoonk/core/player/contracts/exercise-content";
import {
  type ExerciseResources,
  serializeExerciseSteps,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import {
  numberedCheckContent,
  pictureCheckContent,
  playableStepContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { isJsonObject } from "@zoonk/utils/json";

export type ActivityContent = { [field: string]: unknown; template: string };

type ScreenKind = Exclude<TeachingStepKind, "activity" | "spokenAnswer">;

type StepOptions = {
  id?: string;
  image?: PlayableStepImage | null;
  imagePending?: boolean;
  pictureWaitStartedAt?: number;
  optionPictures?: Readonly<Record<string, PlayableStepImage>>;
};

export function contentStep<TKind extends TeachingStepKind>(
  kind: TKind,
  {
    content,
    id = crypto.randomUUID(),
    image = null,
    imagePending = false,
    optionPictures,
    pictureWaitStartedAt = imagePending ? Date.now() : undefined,
  }: StepOptions & { content: object },
): PlayableTeachingStepOf<TKind> {
  return {
    citation: null,
    content: parseStepContent(kind, content),
    id,
    image,
    imagePending,
    ...(pictureWaitStartedAt === undefined ? {} : { pictureWaitStartedAt }),
    kind,
    ...(optionPictures ? { optionPictures } : {}),
    position: 0,
    skillId: null,
  };
}

export function pictureCheckStep({
  drawn = pictureCheckContent.options.map((option) => option.id),
  ...options
}: Omit<StepOptions, "optionPictures"> & { drawn?: readonly string[] } = {}) {
  const optionPictures = Object.fromEntries(
    pictureCheckContent.options.flatMap((option) =>
      drawn.includes(option.id) ? [[option.id, inlineImage({ alt: option.picture.alt })]] : [],
    ),
  );

  return contentStep("check", { content: pictureCheckContent, optionPictures, ...options });
}

export function numberedCheckStep({
  drawn = true,
  ...options
}: StepOptions & { drawn?: boolean } = {}) {
  return contentStep("check", {
    content: numberedCheckContent,
    image: drawn ? inlineImage({ alt: numberedCheckContent.image.alt }) : null,
    ...options,
  });
}

export function diagramPicture(content: ActivityContent): PlayableStepImage | null {
  if (content.template !== "labeledDiagram") {
    return null;
  }

  const picture = isJsonObject(content.fields) ? content.fields.picture : null;

  return isJsonObject(picture) && typeof picture.alt === "string"
    ? inlineImage({ alt: picture.alt })
    : null;
}

export function activityStep({
  content,
  ...options
}: StepOptions & { content: ActivityContent }): PlayableTeachingStepOf<"activity"> {
  return contentStep("activity", {
    content,
    ...options,
    image: options.image ?? diagramPicture(content),
  });
}

export function explanationStep(
  content: object,
  options: StepOptions = {},
): PlayableTeachingStepOf<"explanation"> {
  return contentStep("explanation", { content, ...options });
}

export function teachingStep<TKind extends ScreenKind>(
  kind: TKind,
  options: StepOptions = {},
): PlayableTeachingStepOf<TKind> {
  return contentStep(kind, { content: playableStepContent[kind], ...options });
}

export function spokenAnswerStep(options: StepOptions = {}): PlayableSpokenAnswerStep {
  return {
    ...contentStep("spokenAnswer", { content: playableStepContent.spokenAnswer, ...options }),
    listening: null,
  };
}

const RENT = {
  audioUrl: null,
  distractors: ["deposit", "bill"],
  id: "8b0d7c84-5d4b-4f43-9a51-6a3c2e7b1f01",
  pronunciation: "rént",
  romanization: null,
  translation: "aluguel",
  word: "rent",
};

const HOW_MUCH = {
  audioUrl: null,
  distractors: ["are", "many"],
  explanation: "How much vem antes do verbo, como quanto em português.",
  id: "8b0d7c84-5d4b-4f43-9a51-6a3c2e7b1f02",
  romanization: null,
  sentence: "How much is the rent?",
  translation: "Quanto é o aluguel?",
  translationDistractors: ["renda", "custa"],
};

type PairWord = typeof RENT;

function pairWith(word: PairWord): ExerciseResources {
  return {
    distractorWords: [],
    lessonSentences: [HOW_MUCH],
    lessonWords: [word],
    sentenceWords: [word],
  };
}

const RENT_HINTS = {
  note: "Não confunda com renda, que é income.",
  pronunciationTip: "O `r` do começo é suave, não como em _rato_.",
};

const WORD_KINDS = new Set<ExerciseKind>(["translation", "vocabulary"]);
const SENTENCE_KINDS = new Set<ExerciseKind>(["listening", "reading"]);

const STORED_CONTENT: Partial<Record<ExerciseKind, object>> = {
  alphabet: {
    audioText: "あ",
    audioUrl: null,
    forms: [{ label: "Katakana", symbol: "ア" }],
    pronunciation: "a",
    readingAid: "Like the a in father",
    symbol: "あ",
  },
  fillBlank: playableStepContent.fillBlank,
  matchColumns: {
    pairs: [
      { left: "Electron", right: "Negative charge" },
      { left: "Proton", right: "Positive charge" },
      { left: "Neutron", right: "No charge" },
    ],
    question: "Match each particle to its charge",
  },
  multipleChoice: playableStepContent.multipleChoice,
};

export function languageStep(
  kind: ExerciseKind,
  content: object = STORED_CONTENT[kind] ?? {},
  {
    id = crypto.randomUUID(),
    word: taught,
  }: { id?: string; word?: Pick<PairWord, "translation" | "word"> } = {},
): PlayableLanguageStep {
  const word = taught ? { ...RENT, id: crypto.randomUUID(), ...taught } : RENT;

  const [exercise] = serializeExerciseSteps({
    resources: pairWith(word),
    steps: [
      {
        content,
        id,
        kind,
        position: 0,
        sentence: SENTENCE_KINDS.has(kind) ? HOW_MUCH : null,
        word: WORD_KINDS.has(kind) ? word : null,
      },
    ],
  });

  if (!exercise) {
    throw new Error(`The ${kind} exercise didn't serialize`);
  }

  return {
    exercise,
    id,
    kind,
    position: 0,
    skillId: null,
    wordHints: WORD_KINDS.has(kind) ? RENT_HINTS : null,
  };
}

export const lettersChart: ChartVisual = {
  axisStart: null,
  categories: ["Maio", "Junho", "Julho"],
  categoryLabel: "Mês",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Ofícios respondidos", values: [35, 36, 40] }],
  source: null,
  title: "Ofícios respondidos por mês",
  unit: null,
  valueLabel: "Ofícios",
};

export const lawTimeline: TimelineVisual = {
  events: [
    { date: "1988", detail: "Promulgada em 5 de outubro.", label: "Constituição Federal" },
    { date: "1990", detail: null, label: "Lei nº 8.112, dos servidores federais" },
  ],
  kind: "timeline",
  title: "Leis que organizam o serviço público",
};

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function inlineImage({ alt, id }: { alt: string; id?: string }): PlayableStepImage {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280">',
    '<rect width="1024" height="1280" fill="#f4f4f5" />',
    '<text x="512" y="640" fill="#111827" font-family="Arial, sans-serif" font-size="36" text-anchor="middle">',
    escapeSvgText(alt),
    "</text>",
    "</svg>",
  ].join("");

  return {
    alt,
    height: 1280,
    id: id ?? crypto.randomUUID(),
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: 1024,
  };
}
