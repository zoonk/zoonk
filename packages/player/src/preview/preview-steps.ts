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

/**
 * Lesson screens as the server serves them, from the shared valid fixtures unless a caller passes
 * its own content: stored content parsed the way the lesson read parses it. The player's browser
 * tests and the playground app build their screens here, so both show the same ones. Screens get a
 * new id each time unless `id` is given (the preview keeps them stable between renders).
 */

/** Any activity step content; tests that vary a fixture pass plain objects built from it. */
export type ActivityContent = { [field: string]: unknown; template: string };

type ScreenKind = Exclude<TeachingStepKind, "activity" | "spokenAnswer">;

type StepOptions = {
  id?: string;
  image?: PlayableStepImage | null;
  imagePending?: boolean;
  pictureWaitStartedAt?: number;
  /** A picture question's drawn pictures, by option id. */
  optionPictures?: Readonly<Record<string, PlayableStepImage>>;
};

/** A screen of the given kind with its own stored content. */
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

/**
 * A question whose options are pictures, each drawn (an image of its description) unless it's
 * left out of `drawn`, still on its way while `imagePending`.
 */
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

/**
 * A question about where a part sits in one whole, its picture drawn with a number on each part
 * unless it's still on its way (`imagePending`) or never came.
 */
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

/**
 * A labeled diagram's picture, drawn: its numbers are on the picture the screen shows, whether the
 * diagram is asked about or explored on an explanation.
 */
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

/** An explanation with its own stored content, such as its own personal example slot or none. */
export function explanationStep(
  content: object,
  options: StepOptions = {},
): PlayableTeachingStepOf<"explanation"> {
  return contentStep("explanation", { content, ...options });
}

/** A teaching screen of the shared stored content for its kind. */
export function teachingStep<TKind extends ScreenKind>(
  kind: TKind,
  options: StepOptions = {},
): PlayableTeachingStepOf<TKind> {
  return contentStep(kind, { content: playableStepContent[kind], ...options });
}

/**
 * The shared "say it out loud" screen. No sentence of the lesson is behind it, so it has no
 * listening exercise to swap in for "I can't talk now".
 */
export function spokenAnswerStep(options: StepOptions = {}): PlayableSpokenAnswerStep {
  return {
    ...contentStep("spokenAnswer", { content: playableStepContent.spokenAnswer, ...options }),
    listening: null,
  };
}

/**
 * Language exercises are served with their word banks, serialized by the function the lesson read
 * uses. Their pair is `languageLessonFixture`'s: English for Portuguese speakers, the word "rent"
 * and the sentence "How much is the rent?".
 */

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

/** The pair's resources, with `word` as its word ("rent" unless a test teaches another). */
function pairWith(word: PairWord): ExerciseResources {
  return {
    distractorWords: [],
    lessonSentences: [HOW_MUCH],
    lessonWords: [word],
    sentenceWords: [word],
  };
}

/** Word screens show the word's note and sound tip for this language pair. */
const RENT_HINTS = {
  note: "Não confunda com renda, que é income.",
  pronunciationTip: "O `r` do começo é suave, não como em _rato_.",
};

const WORD_KINDS = new Set<ExerciseKind>(["translation", "vocabulary"]);
const SENTENCE_KINDS = new Set<ExerciseKind>(["listening", "reading"]);

/** Word and sentence screens read the pair; the others store their own content. */
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

/**
 * A language exercise of the given kind on the shared pair, with the word's hints where shown. A
 * kind that stores its own content takes `content` in place of the shared one, and a word screen
 * may teach another word or phrase (`word`, in place of "rent").
 */
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

/** A bar chart a screen draws from its data. */
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

/** A timeline a screen draws from its dated events. */
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

/**
 * A drawn picture for a screen, portrait like the pictures lessons draw, inline so nothing depends
 * on an image host: the same `img` semantics without network errors or 404 fallbacks.
 */
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
