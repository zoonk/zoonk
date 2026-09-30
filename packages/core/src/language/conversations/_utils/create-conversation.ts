import "server-only";
import { LIVE_CONVERSATION_MODEL } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { type Goal, type LanguageConversationKind, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { type ConversationScenario, type SpeakingMockExam } from "../conversation-contract";

type NewConversation = {
  chapterId: string | null;
  goal: Goal | null;
  kind: LanguageConversationKind;
  language: string;
  level: CefrLevel;
  minutes: number;
  /** A speaking mock's scenario also names its exam. */
  scenario: ConversationScenario & { exam?: SpeakingMockExam };
  studyBlockId?: string;
  targetLanguage: string;
  userId: string;
};

/** A new call, ready to connect: nothing is charged until it does. */
export function createConversation(input: NewConversation) {
  return prisma.languageConversation.create({
    data: {
      chapterId: input.chapterId,
      goalId: input.goal?.id ?? null,
      kind: input.kind,
      language: input.language,
      level: input.level,
      liveModel: LIVE_CONVERSATION_MODEL,
      minutes: input.minutes,
      scenario: input.scenario,
      studyBlockId: input.studyBlockId ?? null,
      targetLanguage: input.targetLanguage,
      titleSnapshot: input.scenario.title,
      userId: input.userId,
    },
  });
}
