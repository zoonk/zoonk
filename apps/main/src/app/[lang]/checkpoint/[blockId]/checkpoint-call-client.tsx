"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { CheckpointCallPreparing } from "@zoonk/learn/language/checkpoint-call";

/** A language checkpoint whose call isn't written yet: the learner's tap writes it and opens it. */
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
