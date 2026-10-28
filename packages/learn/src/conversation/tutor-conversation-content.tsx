"use client";

import { useExtracted } from "next-intl";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type TutorCardActions, type TutorCards, getTutorCards } from "./tutor-cards";
import { useTutorIdentity } from "./tutor-identity";

export type TutorSituation = { hasMistake: boolean; hasToday: boolean };

export type TutorConversationContent = TutorCards & {
  composerLabel: string;
  greeting: string;
  greetingAction?: React.ReactNode;
  identity: { avatar: React.ReactNode; name: string };
  onAnswered?: () => void;
  onAsked?: () => void;
  placeholder: string;
  suggestions: { id: string; label: string }[];
};

function useSuggestions(situation: TutorSituation): TutorConversationContent["suggestions"] {
  const t = useExtracted();

  const why = situation.hasToday
    ? t("Why am I studying this today?")
    : t("What's in my plan for today?");

  const doubt = situation.hasMistake
    ? { id: "mistake", label: t("Explain my last mistake") }
    : { id: "focus", label: t("What should I focus on first?") };

  return [
    { id: "today", label: why },
    { id: "lighter", label: t("I want to study less this week") },
    doubt,
  ];
}

export function useTutorConversationContent({
  buddy,
  decide,
  situation,
  tools,
}: TutorCardActions & {
  buddy: LearnBuddy | null;
  situation: TutorSituation;
}): TutorConversationContent {
  const t = useExtracted();
  const identity = useTutorIdentity(buddy);
  const { name } = identity;
  const suggestions = useSuggestions(situation);

  // The hello says the buddy is an AI, since it opens every conversation (EU AI Act art. 50;
  // Decreto 12.880/2026 art. 11 for minors).
  const greeting = t(
    "Hi! I'm {name}, your AI study buddy. Ask me anything about what you're studying, or tell me what you'd like to change in your plan.",
    { name },
  );

  return {
    composerLabel: t("Message {name}", { name }),
    greeting,
    identity,
    placeholder: t("Ask a question or request a change"),
    ...getTutorCards({ decide, tools }),
    suggestions,
  };
}
