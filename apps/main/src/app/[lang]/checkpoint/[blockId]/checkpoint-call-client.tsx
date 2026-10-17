"use client";

import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { runWhenIdle } from "@/lib/run-when-idle";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { CheckpointCallPreparing } from "@zoonk/learn/language/checkpoint-call";
import { type TappedCallAudio } from "@zoonk/learn/language/conversation";
import { CheckpointCallIntro } from "@zoonk/learn/language/conversation-intro";
import { useEffect, useRef, useState, useTransition } from "react";
import { type ConversationClient } from "../../conversation/[conversationId]/conversation-client";
import { startCheckpointCallAction } from "./checkpoint-call-actions";

/**
 * The call's own screen (the live call, its result, and the contract its turns are checked
 * against) isn't part of the intro's first load: it loads once the intro is idle, and Start's tap
 * waits for it alongside the call's creation. A load that failed is null.
 */
function loadConversationClient() {
  return import("../../conversation/[conversationId]/conversation-client")
    .then((mod) => mod.ConversationClient)
    .catch(() => null);
}

/**
 * A language checkpoint whose call isn't written yet: the learner's tap writes it and opens it.
 * Today's study time used up, as the page read it, leaves no Start to tap.
 */
export function CheckpointCallPreviewClient({
  blockId,
  dailyLimitReached,
  intro,
}: {
  blockId: string;
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

  // Leaving (or the screen kept hidden) lets go of the tap's microphone at once, unless its call
  // already took it: a start still on its way never keeps it.
  useEffect(
    () => () => {
      generation.current += 1;
      tappedAudio.current?.release();
    },
    [],
  );

  // The call's screen loads while the learner reads the intro, so Start rarely waits for it. Past
  // today's study time there's no Start to load it for.
  useEffect(() => {
    if (dailyLimitReached) {
      return;
    }

    return runWhenIdle(() => void loadConversationClient());
  }, [dailyLimitReached]);

  if (call) {
    return (
      <call.Client
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

        const [started, Client] = await Promise.all([
          startCheckpointCallAction(blockId),
          loadConversationClient(),
        ]);

        if (mine !== generation.current || learnerGeneration !== getLearnerGeneration()) {
          return "cancelled";
        }

        // It changed since the page showed it (done elsewhere, earlier steps first, today's study
        // time used up, signed out): the page reads it again and opens where it stands, Start busy
        // until it does.
        if (started.status === "changed") {
          startRereading(() => router.refresh());
        }

        if (started.status !== "ready") {
          return started.status;
        }

        // Its screen didn't load (offline for a moment): Start tries again, and opens the same call.
        if (!Client) {
          return "failed";
        }

        setCall({ Client, audio, conversation: started.conversation });
        return "ready";
      }}
    />
  );
}

/** A scenario not written yet keeps its existing explicit preparation flow. */
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
