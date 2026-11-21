/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import {
  type PlayableActivityStep,
  type PlayableLanguageStep,
  type PlayableSpokenAnswerStep,
  type PlayableStepImage,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "@zoonk/core/lesson-player/playable-lesson";
import { getActivityAnswerRules } from "@zoonk/core/library/activities/answers";
import { type StepMarks } from "@zoonk/core/library/marks/contract";
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
import { DRAWN_PICTURE_SIZE } from "@zoonk/learn/picture-box";
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
  marks?: StepMarks | null;
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
    marks = null,
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
    marks,
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
      drawn.includes(option.id)
        ? [[option.id, inlineImage({ alt: option.picture.alt, kind: "option" })]]
        : [],
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

/** An activity screen, its diagram drawn unless `image` is null. */
export function activityStep({
  content,
  ...options
}: StepOptions & { content: ActivityContent }): PlayableActivityStep {
  const step = contentStep("activity", {
    content,
    ...options,
    image: options.image === undefined ? diagramPicture(content) : options.image,
  });

  return { ...step, ...getActivityAnswerRules(step.content) };
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
  ordersPending: false,
  otherSentenceOrders: [],
  otherTranslationOrders: [],
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
    languages: { language: "pt", targetLanguage: "en" },
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
  categories: ["Monday", "Tuesday", "Wednesday"],
  categoryLabel: "Day",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Distance", values: [35, 36, 40] }],
  source: null,
  title: "Distance traveled",
  unit: "km",
  valueLabel: "Distance",
};

export const visitorsChart: ChartVisual = {
  ...lettersChart,
  axisStart: 10_000,
  categories: ["Mar", "Abr", "Mai", "Jun", "Jul"],
  chart: "line",
  series: [{ name: "Visitantes", values: [10_050, 10_120, 10_200, 10_310, 10_380] }],
  title: "Visitantes por mês, com o eixo a partir de 10.000",
  valueLabel: "Visitantes",
};

export const japaneseRegionsChart: ChartVisual = {
  ...lettersChart,
  categories: ["北海道地方", "東北地方", "関東地方", "中部地方", "近畿地方"],
  categoryLabel: "地方",
  series: [{ name: "回答数", values: [18, 42, 64, 30, 22] }],
  title: "地方別の回答数",
  valueLabel: "回答数",
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

const SAMPLE_PICTURE_SIZE = { height: 1280, width: 1024 };
const LABEL_SHARE = 0.05;
const CAPTION_SHARE = 0.036;
const CAPTION_ROOM = 1.7;

/** `kind` draws the sample at the size a new picture of that kind arrives in, the room its wait holds. */
export function inlineImage({
  alt,
  id,
  kind,
}: {
  alt: string;
  id?: string;
  kind?: keyof typeof DRAWN_PICTURE_SIZE;
}): PlayableStepImage {
  const { height, width } = kind ? DRAWN_PICTURE_SIZE[kind] : SAMPLE_PICTURE_SIZE;

  const text = `font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle"`;
  const captionSize = Math.min(width * CAPTION_SHARE, (width * CAPTION_ROOM) / alt.length);

  // A drawn stand-in with its own label, so a sample never reads as a picture that failed to load.
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#f4f4f5" />`,
    `<circle cx="${width * 0.68}" cy="${height * 0.34}" r="${width * 0.07}" fill="#d4d4d8" />`,
    `<path d="M0 ${height * 0.66} L${width * 0.34} ${height * 0.4} L${width * 0.62} ${height * 0.66} Z" fill="#e4e4e7" />`,
    `<path d="M${width * 0.36} ${height * 0.66} L${width * 0.7} ${height * 0.46} L${width} ${height * 0.66} Z" fill="#d4d4d8" />`,
    `<text x="${width / 2}" y="${height * 0.76}" fill="#52525b" font-size="${width * LABEL_SHARE}" font-weight="600" ${text}>Sample picture</text>`,
    `<text x="${width / 2}" y="${height * 0.83}" fill="#71717a" font-size="${captionSize}" ${text}>`,
    escapeSvgText(alt),
    "</text>",
    "</svg>",
  ].join("");

  return {
    alt,
    height,
    id: id ?? crypto.randomUUID(),
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width,
  };
}
