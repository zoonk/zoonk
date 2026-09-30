import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findLearnerLanguageGoal } from "../../language/_utils/language-goal";
import { getSpeakingLevel } from "../../language/conversations/_utils/conversation-goal";
import {
  PRACTICE_CONVERSATION_MINUTES,
  conversationScenarioSchema,
} from "../../language/conversations/conversation-contract";
import { CEFR_BANDS } from "../../language/levels/skill-level-rules";
import { loadLanguageUnits } from "../../language/units/language-units";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getSession } from "../../users/get-session";
import { loadGrammarTips, loadUnitMistakes, loadUnitWords } from "./_utils/unit-content";
import { type LanguageUnitView } from "./language-view-contract";

const DEFAULT_PRACTICE_MINUTES = 2;

export type LanguageUnitViewResult =
  | { status: "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; unit: LanguageUnitView };

function findVisibleUnit({ chapterId, userId }: { chapterId: string; userId: string }) {
  return prisma.chapter.findFirst({
    include: {
      lessons: {
        include: { lesson: { select: { id: true, title: true } } },
        orderBy: { position: "asc" },
      },
    },
    where: { ...libraryRowsVisibleTo(userId), id: chapterId },
  });
}

/** Who the learner talks to in the unit's call, once a call at their level was written. */
async function findCharacter({ chapterId, level }: { chapterId: string; level: string }) {
  const saved = await prisma.conversationScenario.findUnique({
    select: { content: true },
    where: { chapterLevel: { chapterId, level } },
  });

  const scenario = conversationScenarioSchema.safeParse(saved?.content);

  return scenario.success
    ? { name: scenario.data.character.name, role: scenario.data.character.role }
    : null;
}

/**
 * A language unit's page, for Focus and Fun alike: its "I can" objectives and lessons, the grammar
 * tips pinned from its lessons, the words it teaches, the learner's open mistakes on it by skill,
 * and the conversation to practice (1 to 5 minutes).
 */
export async function getLanguageUnitView({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId?: string;
}): Promise<LanguageUnitViewResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const chapter = isUuid(chapterId) ? await findVisibleUnit({ chapterId, userId }) : null;

  if (!chapter) {
    return { status: "notFound" };
  }

  const { targetLanguage } = chapter;

  if (!targetLanguage) {
    return { status: "notLanguage" };
  }

  const goal = await findLearnerLanguageGoal({ goalId, targetLanguage, userId });
  const lessonIds = chapter.lessons.map(({ lesson }) => lesson.id);

  const [units, level, grammarTips, words, mistakes] = await Promise.all([
    goal ? loadLanguageUnits(goal) : [],
    getSpeakingLevel({ goal, targetLanguage, userId }),
    loadGrammarTips(lessonIds),
    loadUnitWords(lessonIds),
    loadUnitMistakes({ lessonIds, userId }),
  ]);

  const unit = units.find((candidate) => candidate.chapterId === chapter.id);

  const done = new Set(
    unit?.lessons.filter((lesson) => lesson.done).map((lesson) => lesson.lessonId),
  );

  return {
    status: "ready",
    unit: {
      conversation: {
        character: await findCharacter({ chapterId: chapter.id, level }),
        defaultMinutes: DEFAULT_PRACTICE_MINUTES,
        minutes: [...PRACTICE_CONVERSATION_MINUTES],
      },
      goalId: goal?.id ?? null,
      grammarTips,
      lessons: chapter.lessons.map(({ lesson }) => ({
        done: done.has(lesson.id),
        lessonId: lesson.id,
        title: lesson.title,
      })),
      mistakes,
      unit: {
        chapterId: chapter.id,
        description: chapter.description,
        levelRange: CEFR_BANDS[chapter.level],
        objectives: chapter.objectives,
        position: unit?.position ?? null,
        title: chapter.title,
      },
      words,
    },
  };
}
