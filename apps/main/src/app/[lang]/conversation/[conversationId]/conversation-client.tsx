"use client";

import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import {
  type ConversationActions,
  type ConversationHrefs,
  ConversationScreen,
  type TappedCallAudio,
} from "@zoonk/learn/language/conversation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import {
  checkObjectivesAction,
  completeConversationAction,
  connectConversationAction,
  endConversationConnectionAction,
} from "./conversation-actions";

function getHrefs({
  conversation,
  fromExam,
  fromMock,
}: {
  conversation: LanguageConversationView;
  fromExam: boolean;
  fromMock: string | null;
}): ConversationHrefs {
  if (fromMock) {
    return { exit: `/mock/${fromMock}`, next: `/mock/${fromMock}` };
  }

  if (conversation.kind === "checkpoint") {
    return { exit: "/today", next: "/session" };
  }

  if (conversation.unit) {
    const unit = `/content/units/${conversation.unit.chapterId}`;
    return { exit: unit, next: unit };
  }

  if (fromExam) {
    return { exit: "/exam", next: "/exam", nextTask: (task) => `/exam?task=${task}` };
  }

  if (conversation.examTask) {
    return { exit: "/speaking", next: "/speaking", nextTask: (task) => `/speaking?task=${task}` };
  }

  return { exit: "/plan", next: "/plan" };
}

/** A mock's task goes straight back to the mock once saved: the mock shows no feedback until it's over. */
export function ConversationClient({
  buddy,
  callAudio,
  conversation,
  fromExam,
  fromMock,
}: {
  buddy: LearnBuddy;
  callAudio?: TappedCallAudio;
  conversation: LanguageConversationView;
  fromExam: boolean;
  fromMock: string | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const startConversation = useStartLanguageConversation(fromExam ? { from: "exam" } : {});
  const { examTask, goalId, id, kind } = conversation;
  const examTaskKey = examTask && examTask.sectionId === null ? examTask.task.key : null;

  const actions = useMemo<ConversationActions>(
    () => ({
      checkObjectives: (turns) => checkObjectivesAction(id, { turns }),
      complete: (input) =>
        completeConversationAction(id, { ...input, timeZone: getLocalTimeZone() }),
      connect: (input) => connectConversationAction({ conversationId: id, input, locale }),
      end: (connectionId) => endConversationConnectionAction(id, connectionId),
      ...(kind === "speakingMock" && goalId
        ? {
            startAgain: async () => {
              await startConversation({ goalId, kind: "speakingMock" });
            },
          }
        : {}),
      ...(examTaskKey && goalId
        ? {
            startAgain: async () => {
              await startConversation({ goalId, kind: "examSpeaking", task: examTaskKey });
            },
          }
        : {}),
    }),
    [examTaskKey, goalId, id, kind, locale, startConversation],
  );

  return (
    <ConversationScreen
      actions={actions}
      buddy={buddy}
      callAudio={callAudio}
      conversation={conversation}
      hrefs={getHrefs({ conversation, fromExam, fromMock })}
      onSaved={fromMock ? () => router.replace(`/mock/${fromMock}`) : undefined}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
    />
  );
}
