"use client";

import { useOpenLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type SpeakingPaperView } from "@zoonk/core/language/exam-speaking/contract";
import { SpeakingPracticeScreen } from "@zoonk/learn/language/speaking";
import { useSearchParams } from "next/navigation";

/** The speaking practice page with main's way to start a task; `?task=` opens one. */
export function SpeakingClient({ goalId, paper }: { goalId: string; paper: SpeakingPaperView }) {
  const openConversation = useOpenLanguageConversation();
  const searchParams = useSearchParams();

  return (
    <SpeakingPracticeScreen
      backHref="/today"
      onStart={(task) => openConversation({ goalId, kind: "examSpeaking", task })}
      openTask={searchParams.get("task")}
      paper={paper}
      resultHref={(conversationId) => `/conversation/${conversationId}`}
    />
  );
}
