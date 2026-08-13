import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type TransactionClient } from "@zoonk/db";
import { type AlphabetLessonContent } from "./_utils/generated-lesson-content";
import {
  type GeneratedLessonGroup,
  persistGeneratedLessonGroups,
} from "./_utils/persist-generated-lesson-groups";
import { splitLessonItems } from "./_utils/split-lesson-items";
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
 * Writes every alphabet part through the transaction that also creates and
 * completes its lesson rows. Only the first part keeps the generated intro.
 */
async function persistAlphabetGroups({
  audioUrls,
  content,
  groups,
  symbolGroups,
  transaction,
}: {
  audioUrls: Record<string, string>;
  content: AlphabetLessonContent;
  groups: GeneratedLessonGroup[];
  symbolGroups: AlphabetLessonContent["symbols"][];
  transaction: TransactionClient;
}): Promise<void> {
  if (groups.length !== symbolGroups.length) {
    throw new Error("Alphabet groups do not match generated symbol groups");
  }

  await transaction.step.deleteMany({
    where: { lessonId: { in: groups.map((group) => group.sourceLesson.id) } },
  });

  const data = groups.flatMap((group, groupIndex) => {
    const symbols = symbolGroups[groupIndex];

    if (!symbols) {
      throw new Error("Alphabet lesson group has no symbols");
    }

    const steps = buildAlphabetLessonSteps({
      audioUrls,
      content: { intro: groupIndex === 0 ? content.intro : [], kind: "alphabet", symbols },
    });

    return steps.map((step, position) => ({
      content: step.content,
      isPublished: true,
      kind: step.kind,
      lessonId: group.sourceLesson.id,
      position,
    }));
  });

  await transaction.step.createMany({ data });
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
  workflowRunId,
}: {
  audioUrls: Record<string, string>;
  content: AlphabetLessonContent;
  context: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  if (content.symbols.length === 0) {
    throw new Error("Alphabet save step received no symbols");
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveAlphabetLesson" });

  const symbolGroups = splitLessonItems(content.symbols);

  await persistGeneratedLessonGroups({
    chapterId: context.chapterId,
    groupCount: symbolGroups.length,
    lessonId: context.id,
    persistGroups: ({ groups, transaction }) =>
      persistAlphabetGroups({ audioUrls, content, groups, symbolGroups, transaction }),
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "saveAlphabetLesson" });
}
