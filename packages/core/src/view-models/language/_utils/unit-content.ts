import "server-only";
import { prisma } from "@zoonk/db";
import { safeParseStepContent } from "../../../library/steps/contract/step-contract";
import { readMistakeSnapshot } from "../../../mistakes/mistake-snapshot";
import { type LanguageMistakeSkill, type LanguageUnitView } from "../language-view-contract";

/** Pinned tips stay a short list; the lessons hold the rest. */
const MAX_GRAMMAR_TIPS = 6;
const WORD_SAMPLE_SIZE = 6;
const MAX_UNIT_MISTAKES = 30;

/** Which "Review my mistakes" filter a notebook entry belongs to, from its screen kind. */
const MISTAKE_SKILLS: Partial<Record<string, LanguageMistakeSkill>> = {
  listening: "listening",
  spoken: "speaking",
  spokenAnswer: "speaking",
  translation: "words",
  typed: "writing",
  typedAnswer: "writing",
  vocabulary: "words",
};

/** The unit's grammar tips: each lesson's tip screen, in lesson order. */
export async function loadGrammarTips(
  lessonIds: string[],
): Promise<LanguageUnitView["grammarTips"]> {
  const steps = await prisma.step.findMany({
    orderBy: [{ lessonId: "asc" }, { position: "asc" }],
    select: { content: true, lessonId: true },
    where: { kind: "explanation", lessonId: { in: lessonIds } },
  });

  return steps
    .toSorted((a, b) => lessonIds.indexOf(a.lessonId) - lessonIds.indexOf(b.lessonId))
    .flatMap((step) => {
      const content = safeParseStepContent("explanation", step.content);

      return content.success && content.data.title
        ? [{ text: content.data.text, title: content.data.title }]
        : [];
    })
    .slice(0, MAX_GRAMMAR_TIPS);
}

/** How many words the unit teaches, with the first few to show. */
export async function loadUnitWords(lessonIds: string[]): Promise<LanguageUnitView["words"]> {
  const links = await prisma.lessonWord.findMany({
    include: { word: { select: { word: true } } },
    orderBy: [{ lessonId: "asc" }, { position: "asc" }],
    where: { lessonId: { in: lessonIds } },
  });

  const words = [...new Map(links.map((link) => [link.wordId, link.word.word])).values()];
  return { count: words.length, sample: words.slice(0, WORD_SAMPLE_SIZE) };
}

/** The learner's open mistakes on the unit's screens, newest first, grouped by skill. */
export async function loadUnitMistakes({
  lessonIds,
  userId,
}: {
  lessonIds: string[];
  userId: string;
}): Promise<LanguageUnitView["mistakes"]> {
  const mistakes = await prisma.mistake.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, snapshot: true },
    take: MAX_UNIT_MISTAKES,
    where: { status: "open", step: { lessonId: { in: lessonIds } }, userId },
  });

  return mistakes.map((mistake) => {
    const snapshot = readMistakeSnapshot(mistake.snapshot);

    return {
      answer: snapshot.answer,
      correctAnswer: snapshot.correctAnswer ?? null,
      explanation: snapshot.explanation ?? null,
      id: mistake.id,
      question: snapshot.question,
      skill: snapshot.format ? (MISTAKE_SKILLS[snapshot.format] ?? null) : null,
    };
  });
}
