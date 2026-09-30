import "server-only";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import {
  type ConversationScenario,
  type SpeakingMockExam,
  conversationScenarioSchema,
} from "../conversation-contract";

type ScenarioUnit = {
  description: string;
  id: string;
  language: string;
  objectives: string[];
  targetLanguage: string;
  title: string;
};

/**
 * What each exam's speaking mock asks for, in English: the scenario writer turns it into the
 * examiner. TOEFL iBT Speaking is about 8 minutes: 7 sentences to repeat, then 4 interview
 * questions with 45 seconds each (ETS, "Updated TOEFL iBT Test Overview", checked Sep 2026:
 * https://www.in.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-overview.pdf).
 */
const SPEAKING_MOCK_UNITS: Record<
  SpeakingMockExam,
  { canDo: string[]; description: string; title: string }
> = {
  ielts: {
    canDo: [
      "Part 1: answer short questions about yourself, your home and your routine",
      "Part 2: talk for about a minute about a cue card topic",
      "Part 3: discuss wider questions about the same topic",
    ],
    description:
      "A short mock of the IELTS Speaking test: its three parts compressed into about five minutes, with an examiner who asks the questions and keeps time.",
    title: "IELTS Speaking test",
  },
  toefl: {
    canDo: [
      "Listen and Repeat: repeat seven sentences exactly as you hear them, in a campus or academic setting, each longer and more complex than the last",
      "Take an Interview: answer four interview questions, from facts about yourself to opinions, explanations and predictions, for up to about 45 seconds each",
    ],
    description:
      "A short mock of the TOEFL iBT Speaking section: its two tasks compressed into about five minutes instead of about eight, with an examiner who says each sentence and question once.",
    title: "TOEFL iBT Speaking section",
  },
};

function findSavedScenario({ chapterId, level }: { chapterId: string; level: CefrLevel }) {
  return prisma.conversationScenario.findUnique({ where: { chapterLevel: { chapterId, level } } });
}

/** A unit's call at a level when it's written, without writing it. */
export async function findUnitScenario(where: {
  chapterId: string;
  level: CefrLevel;
}): Promise<ConversationScenario | null> {
  const saved = await findSavedScenario(where);
  const parsed = conversationScenarioSchema.safeParse(saved?.content);
  return parsed.success ? parsed.data : null;
}

/**
 * A unit's call at a level, written once and shared by every learner of the unit. Two learners
 * starting at the same moment may both write one; the first saved wins.
 */
export async function getUnitScenario({
  level,
  unit,
  userId,
}: {
  level: CefrLevel;
  unit: ScenarioUnit;
  userId: string;
}): Promise<ConversationScenario> {
  const saved = await findSavedScenario({ chapterId: unit.id, level });
  const parsed = conversationScenarioSchema.safeParse(saved?.content);

  if (parsed.success) {
    return parsed.data;
  }

  const { data, provenance } = await generateConversationScenario({
    analytics: { contentScope: "shared", distinctId: userId },
    canDo: unit.objectives,
    learnerLanguage: unit.language,
    level,
    targetLanguage: unit.targetLanguage,
    unitDescription: unit.description,
    unitTitle: unit.title,
  });

  const row = { content: data, ...toProvenanceData(provenance) };
  const where = { chapterLevel: { chapterId: unit.id, level } };

  if (saved) {
    await prisma.conversationScenario.update({ data: row, where });
    return conversationScenarioSchema.parse(data);
  }

  try {
    await prisma.conversationScenario.create({ data: { ...row, chapterId: unit.id, level } });
    return conversationScenarioSchema.parse(data);
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const winner = await prisma.conversationScenario.findUniqueOrThrow({ where });
    return conversationScenarioSchema.parse(winner.content);
  }
}

/**
 * The examiner and script of one speaking mock for its exam: IELTS's cue card and questions, or
 * TOEFL's sentences to repeat and interview questions. Each mock gets its own, so a learner who
 * tries again meets a new topic.
 */
export async function getSpeakingMockScenario({
  exam,
  goalId,
  language,
  level,
  targetLanguage,
  userId,
}: {
  exam: SpeakingMockExam;
  goalId: string;
  language: string;
  level: CefrLevel;
  targetLanguage: string;
  userId: string;
}): Promise<ConversationScenario> {
  const unit = SPEAKING_MOCK_UNITS[exam];

  const { data } = await generateConversationScenario({
    analytics: { contentScope: "personal", distinctId: userId, goalId },
    canDo: unit.canDo,
    learnerLanguage: language,
    level,
    targetLanguage,
    unitDescription: unit.description,
    unitTitle: unit.title,
  });

  return conversationScenarioSchema.parse(data);
}
