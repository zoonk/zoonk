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

/**
 * Where a call leads: a checkpoint back to today's session, which opens the next block; practice
 * back to its unit; an exam task to the exam screen it was started from, or else to the speaking
 * practice page, where its "Next" opens the paper's next task; a speaking mock to the Plan.
 */
function getHrefs({
  conversation,
  fromExam,
  fromMock,
}: {
  conversation: LanguageConversationView;
  fromExam: boolean;
  fromMock: string | null;
}): ConversationHrefs {
  // A mock's speaking task goes back to the mock, which opens its next task.
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

  // A language goal's exam-style tasks live on their own page, where "Next" opens the next one.
  if (conversation.examTask) {
    return { exit: "/speaking", next: "/speaking", nextTask: (task) => `/speaking?task=${task}` };
  }

  return { exit: "/plan", next: "/plan" };
}

/**
 * Wires the call screen to the app: opening the call, its goals, saving it, another try (a new
 * speaking mock, or the same exam task with a new card), and a milestone the call earned as its
 * full-screen moment. A mock's task goes straight back to the mock once saved: the mock shows no
 * feedback until it's over.
 */
export function ConversationClient({
  buddy,
  callAudio,
  conversation,
  fromExam,
  fromMock,
}: {
  /** The learner's buddy (`getLearnerBuddy`), for the result's missions and ceremony. */
  buddy: LearnBuddy;
  /** A checkpoint's Start tap that created the call: it starts at once, with the tap's microphone. */
  callAudio?: TappedCallAudio;
  conversation: LanguageConversationView;
  fromExam: boolean;
  /** The mock whose speaking section the call is a task of, which it leads back to. */
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
      // A task of a whole paper (a mock's section) goes on with its section instead.
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
