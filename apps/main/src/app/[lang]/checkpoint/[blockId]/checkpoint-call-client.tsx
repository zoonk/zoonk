"use client";

import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { runWhenIdle } from "@/lib/run-when-idle";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { CheckpointCallPreparing } from "@zoonk/learn/language/checkpoint-call";
import { type TappedCallAudio } from "@zoonk/learn/language/conversation";
import { CheckpointCallIntro } from "@zoonk/learn/language/conversation-intro";
import { useEffect, useRef, useState, useTransition } from "react";
import { type ConversationClient } from "../../conversation/[conversationId]/conversation-client";
import { startCheckpointCallAction } from "./checkpoint-call-actions";

/** Out of the intro's first load: it loads once the intro is idle, or with Start's tap. */
function loadConversationClient() {
  return import("../../conversation/[conversationId]/conversation-client")
    .then((mod) => mod.ConversationClient)
    .catch(() => null);
}

export function CheckpointCallPreviewClient({
  blockId,
  buddy,
  dailyLimitReached,
  intro,
}: {
  blockId: string;
  buddy: LearnBuddy;
  dailyLimitReached: boolean;
  intro: LanguageConversationIntro;
}) {
  const router = useRouter();

  const [call, setCall] = useState<{
    Client: typeof ConversationClient;
    audio: TappedCallAudio;
    conversation: LanguageConversationView;
  } | null>(null);

  const [rereading, startRereading] = useTransition();
  const generation = useRef(0);
  const tappedAudio = useRef<TappedCallAudio | null>(null);

  // A start still on its way never keeps the tap's microphone once the learner leaves.
  useEffect(
    () => () => {
      generation.current += 1;
      tappedAudio.current?.release();
    },
    [],
  );

  useEffect(() => {
    if (dailyLimitReached) {
      return;
    }

    return runWhenIdle(() => void loadConversationClient());
  }, [dailyLimitReached]);

  if (call) {
    return (
      <call.Client
        buddy={buddy}
        callAudio={call.audio}
        conversation={call.conversation}
        fromExam={false}
        fromMock={null}
      />
    );
  }

  return (
    <CheckpointCallIntro
      conversation={intro}
      dailyLimitReached={dailyLimitReached}
      rereading={rereading}
      onStart={async (audio) => {
        tappedAudio.current = audio;
        const mine = generation.current;
        const learnerGeneration = getLearnerGeneration();

        const isCurrent = () =>
          mine === generation.current && learnerGeneration === getLearnerGeneration();

        const client = loadConversationClient();
        const started = await startCheckpointCallAction(blockId);

        if (!isCurrent()) {
          return "cancelled";
        }

        if (started.status === "changed") {
          startRereading(() => router.refresh());
        }

        if (started.status !== "ready") {
          return started.status;
        }

        const Client = await client;

        if (!isCurrent()) {
          return "cancelled";
        }

        if (!Client) {
          return "failed";
        }

        setCall({ Client, audio, conversation: started.conversation });
        return "ready";
      }}
    />
  );
}

export function CheckpointCallClient({
  blockId,
  unitTitle,
}: {
  blockId: string;
  unitTitle: string;
}) {
  const startConversation = useStartLanguageConversation();

  return (
    <CheckpointCallPreparing
      exitHref="/today"
      onStart={() => startConversation({ blockId, kind: "checkpoint" })}
      unitTitle={unitTitle}
    />
  );
}
