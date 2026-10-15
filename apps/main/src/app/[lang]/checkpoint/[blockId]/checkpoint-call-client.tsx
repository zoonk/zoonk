"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { CheckpointCallPreparing } from "@zoonk/learn/language/checkpoint-call";
import { CheckpointCallIntro } from "@zoonk/learn/language/conversation-intro";
import { useEffect, useRef, useState } from "react";
import { ConversationClient } from "../../conversation/[conversationId]/conversation-client";
import { startCheckpointCallAction } from "./checkpoint-call-actions";

/** A language checkpoint whose call isn't written yet: the learner's tap writes it and opens it. */
export function CheckpointCallPreviewClient({
  blockId,
  intro,
}: {
  blockId: string;
  intro: LanguageConversationIntro;
}) {
  const [conversation, setConversation] = useState<LanguageConversationView | null>(null);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  if (conversation) {
    return (
      <ConversationClient
        conversation={conversation}
        fromExam={false}
        fromMock={null}
        startWithCall
      />
    );
  }

  return (
    <CheckpointCallIntro
      conversation={intro}
      onStart={async () => {
        const mine = generation.current;
        const learnerGeneration = getLearnerGeneration();
        const started = await startCheckpointCallAction(blockId);

        if (mine !== generation.current || learnerGeneration !== getLearnerGeneration()) {
          return "cancelled";
        }

        if (started.status !== "ready") {
          return started.status;
        }

        setConversation(started.conversation);
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
