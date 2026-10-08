import "server-only";
import { prisma } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { safeParseStepContent } from "../../../library/steps/contract/step-contract";
import { readMistakeSnapshot } from "../../../mistakes/mistake-snapshot";
import { type LanguageMistakeSkill, type LanguageUnitView } from "../language-view-contract";

/** Pinned tips stay a short list; the lessons hold the rest. */
const MAX_GRAMMAR_TIPS = 6;
const WORD_SAMPLE_SIZE = 6;

/** The filters for answers the learner heard, said or wrote, by the screen or question format. */
const MISTAKE_SKILLS: Partial<Record<string, LanguageMistakeSkill>> = {
  essay: "writing",
  listening: "listening",
  spoken: "speaking",
  spokenAnswer: "speaking",
  typed: "writing",
  typedAnswer: "writing",
};

/**
 * Every other mistake (vocabulary, translation, reading, a gap, a match, a review's multiple
 * choice) was about what words mean, so it's under Words: each mistake has a filter and the
 * filters add up to the unit's count.
 */
const DEFAULT_MISTAKE_SKILL: LanguageMistakeSkill = "words";

function getMistakeSkill(format: string | undefined): LanguageMistakeSkill {
  return (format && MISTAKE_SKILLS[format]) || DEFAULT_MISTAKE_SKILL;
}

/** The unit's grammar tips: each lesson's tip screen, in lesson order. */
export async function loadGrammarTips(
  lessonIds: string[],
): Promise<LanguageUnitView["grammarTips"]> {
  const steps = await prisma.step.findMany({
    orderBy: [{ lessonId: "asc" }, { position: "asc" }],
    select: { content: true, lessonId: true },
    where: { kind: "explanation", lessonId: { in: lessonIds }, ...CURRENT_STEPS },
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

/**
 * The learner's open mistakes on the unit, newest first, each under one skill filter: every one on
 * its lessons' screens or on the skills its lessons teach, wherever it was made (a lesson, a
 * review, practice), as the chapter page and Progress count them.
 */
export async function loadUnitMistakes({
  lessonIds,
  userId,
}: {
  lessonIds: string[];
  userId: string;
}): Promise<LanguageUnitView["mistakes"]> {
  const skills = await prisma.lessonSkill.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: { lessonId: { in: lessonIds } },
  });

  const mistakes = await prisma.mistake.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, snapshot: true },
    where: {
      OR: [
        { step: { lessonId: { in: lessonIds } } },
        { skillId: { in: skills.map((skill) => skill.skillId) } },
      ],
      status: "open",
      userId,
    },
  });

  return mistakes.map((mistake) => {
    const snapshot = readMistakeSnapshot(mistake.snapshot);

    return {
      answer: snapshot.answer,
      correctAnswer: snapshot.correctAnswer ?? null,
      explanation: snapshot.explanation ?? null,
      id: mistake.id,
      question: snapshot.question,
      skill: getMistakeSkill(snapshot.format),
    };
  });
}
