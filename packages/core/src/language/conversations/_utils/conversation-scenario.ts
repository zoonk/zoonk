import "server-only";
import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { generateSpeakingMockScenario } from "@zoonk/ai/tasks/v2/language/speaking-mock-scenario";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import {
  type ConversationScenario,
  type SpeakingMockExam,
  conversationScenarioSchema,
} from "../conversation-contract";
import { SPEAKING_MOCK_MINUTES } from "../speaking-mock-format";

type ScenarioUnit = {
  description: string;
  id: string;
  language: string;
  objectives: string[];
  targetLanguage: string;
  title: string;
};

function findSavedScenario({ chapterId, level }: { chapterId: string; level: CefrLevel }) {
  return prisma.conversationScenario.findUnique({ where: { chapterLevel: { chapterId, level } } });
}

export async function findUnitScenario(where: {
  chapterId: string;
  level: CefrLevel;
}): Promise<ConversationScenario | null> {
  const saved = await findSavedScenario(where);
  const parsed = conversationScenarioSchema.safeParse(saved?.content);
  return parsed.success ? parsed.data : null;
}

export async function getUnitScenario({
  level,
  unit,
  userId,
}: {
  level: CefrLevel;
  unit: ScenarioUnit;
  userId: string;
}): Promise<ConversationScenario> {
  const saved = await findUnitScenario({ chapterId: unit.id, level });

  if (saved) {
    return saved;
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

  try {
    await prisma.conversationScenario.create({
      data: { content: data, ...toProvenanceData(provenance), chapterId: unit.id, level },
    });

    return conversationScenarioSchema.parse(data);
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const winner = await findSavedScenario({ chapterId: unit.id, level });
    return conversationScenarioSchema.parse(winner?.content);
  }
}

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
  const { data } = await generateSpeakingMockScenario({
    analytics: { contentScope: "personal", distinctId: userId, goalId },
    exam,
    learnerLanguage: language,
    level,
    minutes: SPEAKING_MOCK_MINUTES,
    targetLanguage,
  });

  return conversationScenarioSchema.parse(data);
}
