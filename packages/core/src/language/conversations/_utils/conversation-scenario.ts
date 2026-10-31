import "server-only";
import { generateConversationScenario } from "@zoonk/ai/tasks/language/conversation-scenario";
import { generateSpeakingMockScenario } from "@zoonk/ai/tasks/language/speaking-mock-scenario";
import { prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import { type ScenarioUnit } from "../call-writing-contract";
import {
  type ConversationScenario,
  type SpeakingMockExam,
  conversationScenarioSchema,
} from "../conversation-contract";
import { SPEAKING_MOCK_MINUTES } from "../speaking-mock-format";

export function toScenarioUnit(unit: ScenarioUnit): ScenarioUnit {
  const { description, id, language, objectives, targetLanguage, title } = unit;
  return { description, id, language, objectives, targetLanguage, title };
}

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

/** Workflow only: a request reads the saved scenario and asks for this when it's missing. */
export async function writeUnitScenario({
  level,
  unit,
  userId,
}: {
  level: CefrLevel;
  unit: ScenarioUnit;
  userId: string;
}): Promise<void> {
  if (await findUnitScenario({ chapterId: unit.id, level })) {
    return;
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

  await prisma.conversationScenario.createMany({
    data: [{ content: data, ...toProvenanceData(provenance), chapterId: unit.id, level }],
    skipDuplicates: true,
  });
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
