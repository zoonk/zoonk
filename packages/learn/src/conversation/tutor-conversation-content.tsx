"use client";

import { useExtracted } from "next-intl";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type TutorCardActions, type TutorCards, getTutorCards } from "./tutor-cards";
import { useTutorIdentity } from "./tutor-identity";

/**
 * What the buddy's first suggestions lean on: whether today's session is there and whether the
 * learner has an open mistake in this goal (the buddy sees the latest ones).
 */
export type TutorSituation = { hasMistake: boolean; hasToday: boolean };

/** Everything a host's conversation needs from the buddy: who it is and how it starts. */
export type TutorConversationContent = TutorCards & {
  composerLabel: string;
  greeting: string;
  /** One action under the hello, such as customizing the learner's default buddy. */
  greetingAction?: React.ReactNode;
  identity: { avatar: React.ReactNode; name: string };
  /** An answer the learner waited for came in: the buddy's face reacts to it. */
  onAnswered?: () => void;
  /** The learner asked something: the buddy's face reacts to it. */
  onAsked?: () => void;
  placeholder: string;
  suggestions: { id: string; label: string }[];
};

/**
 * Three ways to start, from the learner's day: why today's lessons, a lighter week (a plan change),
 * and a doubt: their latest mistake when there is one.
 */
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

/**
 * The buddy as the learner's tutor: its name and face in the conversation, its hello, how the
 * composer asks, the first suggestions, the card for a plan change it proposes and the button for
 * an app tool it offers.
 */
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

  // The placeholder teaches both things the buddy does: answer, and change the plan.
  return {
    composerLabel: t("Message {name}", { name }),
    greeting,
    identity,
    placeholder: t("Ask a question or request a change"),
    ...getTutorCards({ decide, tools }),
    suggestions,
  };
}
