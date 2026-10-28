import "server-only";
import { LIVE_CONVERSATION_MODEL } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { type Goal, type LanguageConversationKind, type prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { type ExamTaskSnapshot } from "../../exam-speaking/speaking-contract";
import { type ConversationScenario, type SpeakingMockExam } from "../conversation-contract";

type NewConversation = {
  chapterId: string | null;
  goal: Goal | null;
  kind: LanguageConversationKind;
  language: string;
  level: CefrLevel;
  markChanged: true;
  minutes: number;
  scenario: ConversationScenario & { exam?: SpeakingMockExam; examTask?: ExamTaskSnapshot };
  sectionId?: string;
  studyBlockId?: string;
  targetLanguage: string;
  userId: string;
};

export function createConversation(input: NewConversation) {
  const create = (client: Pick<typeof prisma, "languageConversation">) =>
    client.languageConversation.create({
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

  return writeLearnerChange({ userId: input.userId }, create);
}
