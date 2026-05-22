import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type AlphabetLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

const MAX_MATCHING_PAIRS = 8;

type AlphabetSymbol = AlphabetLessonContent["symbols"][number];
type AlphabetIntro = AlphabetLessonContent["intro"][number];

/**
 * Turns optional intro copy into a visible read step before the symbol cards.
 */
function buildIntroStep(intro: AlphabetIntro) {
  return {
    content: assertStepContent("static", { text: intro.text, title: intro.title, variant: "text" }),
    kind: "static" as const,
  };
}

/**
 * Converts generated symbol data into the strict player-facing alphabet card
 * content.
 */
function buildAlphabetCardContent({
  audioUrls,
  symbol,
}: {
  audioUrls: Record<string, string>;
  symbol: AlphabetSymbol;
}) {
  return assertStepContent("alphabet", {
    audioText: symbol.audioText,
    audioUrl: audioUrls[symbol.audioText] ?? null,
    forms: symbol.forms,
    pronunciation: symbol.pronunciation,
    readingAid: symbol.readingAid,
    symbol: symbol.symbol,
  });
}

/**
 * Builds the read-only symbol card that teaches the shape, reading aid, and
 * contextual forms.
 */
function buildAlphabetCardStep({
  audioUrls,
  symbol,
}: {
  audioUrls: Record<string, string>;
  symbol: AlphabetSymbol;
}) {
  return { content: buildAlphabetCardContent({ audioUrls, symbol }), kind: "alphabet" as const };
}

/**
 * Converts each generated symbol into one read-only card.
 */
function buildSymbolSteps({
  audioUrls,
  symbols,
}: {
  audioUrls: Record<string, string>;
  symbols: AlphabetLessonContent["symbols"];
}) {
  return symbols.map((symbol) => buildAlphabetCardStep({ audioUrls, symbol }));
}

/**
 * Finishes a multi-symbol lesson with a compact matching drill. This gives the
 * learner one final comparison pass without turning long generated lessons into
 * an overwhelming matching grid.
 */
function buildMatchingPracticeSteps(content: AlphabetLessonContent) {
  if (content.symbols.length < 2) {
    return [];
  }

  const matchingSymbols = content.symbols.slice(0, MAX_MATCHING_PAIRS);

  return [
    {
      content: assertStepContent("matchColumns", {
        pairs: matchingSymbols.map((symbol) => ({ left: symbol.symbol, right: symbol.readingAid })),
      }),
      kind: "matchColumns" as const,
    },
  ];
}

/**
 * Creates the full alphabet lesson sequence: optional intro, symbol cards, then
 * a final matching drill when there is more than one symbol.
 */
function buildAlphabetLessonSteps({
  audioUrls,
  content,
}: {
  audioUrls: Record<string, string>;
  content: AlphabetLessonContent;
}) {
  return [
    ...content.intro.map(buildIntroStep),
    ...buildSymbolSteps({ audioUrls, symbols: content.symbols }),
    ...buildMatchingPracticeSteps(content),
  ];
}

/**
 * Persists alphabet lessons as writing-system content instead of chapter words.
 *
 * The saved steps are still reviewable through their matching drill, but the
 * taught symbols do not become vocabulary resources.
 */
export async function saveAlphabetLessonStep({
  audioUrls,
  content,
  context,
}: {
  audioUrls: Record<string, string>;
  content: AlphabetLessonContent;
  context: LessonContext;
}): Promise<void> {
  "use step";

  if (content.symbols.length === 0) {
    throw new Error("Alphabet save step received no symbols");
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveAlphabetLesson" });

  await prisma.step.deleteMany({ where: { lessonId: context.id } });

  const steps = buildAlphabetLessonSteps({ audioUrls, content });

  await prisma.step.createMany({
    data: steps.map((step, position) => ({
      content: step.content,
      isPublished: true,
      kind: step.kind,
      lessonId: context.id,
      position,
    })),
  });

  await stream.status({ status: "completed", step: "saveAlphabetLesson" });
}
