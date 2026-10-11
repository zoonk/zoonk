import "server-only";
import { LIVE_CONVERSATION_MODEL } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { type Goal, type LanguageConversationKind, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { type ExamTaskSnapshot } from "../../exam-speaking/speaking-contract";
import { type ConversationScenario, type SpeakingMockExam } from "../conversation-contract";

type NewConversation = {
  chapterId: string | null;
  goal: Goal | null;
  kind: LanguageConversationKind;
  language: string;
  level: CefrLevel;
  minutes: number;
  /** A speaking mock's scenario also names its exam, and an exam task's its paper and card. */
  scenario: ConversationScenario & { exam?: SpeakingMockExam; examTask?: ExamTaskSnapshot };
  /** The whole speaking paper an exam task belongs to. */
  sectionId?: string;
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
      sectionId: input.sectionId ?? null,
      studyBlockId: input.studyBlockId ?? null,
      targetLanguage: input.targetLanguage,
      titleSnapshot: input.scenario.title,
      userId: input.userId,
    },
  });
}
