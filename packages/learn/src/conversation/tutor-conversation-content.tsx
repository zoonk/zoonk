"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { CalendarCogIcon, CalendarDaysIcon, TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useTutorIdentity } from "./tutor-identity";
import { type DecideTutorPlanChange, TutorPlanChange } from "./tutor-plan-change";
import { type TutorToolActions, TutorToolOfferCard } from "./tutor-tool-offer";

/**
 * What the buddy's first suggestions lean on: whether today's session is there and whether the
 * learner has an open mistake in this goal (the buddy sees the latest ones).
 */
export type TutorSituation = { hasMistake: boolean; hasToday: boolean };

/** Everything a host's conversation needs from the buddy: who it is and how it starts. */
export type TutorConversationContent = {
  composerLabel: string;
  greeting: string;
  identity: { avatar: React.ReactNode; name: string };
  placeholder: string;
  renderPlanChange: (input: {
    change: PlanChangeView;
    onAnswered: (change: PlanChangeView) => void;
  }) => React.ReactNode;
  renderToolOffer: (offer: TutorToolOffer) => React.ReactNode;
  suggestions: { icon: React.ReactNode; id: string; label: string }[];
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
    ? {
        icon: <KindTile kind="mistakes" size="sm" />,
        id: "mistake",
        label: t("Explain my last mistake"),
      }
    : {
        icon: <KindTile icon={TargetIcon} kind="lesson" size="sm" />,
        id: "focus",
        label: t("What should I focus on first?"),
      };

  return [
    { icon: <KindTile icon={CalendarDaysIcon} kind="lesson" size="sm" />, id: "today", label: why },
    { icon: <PlanChangeTile />, id: "lighter", label: t("I want to study less this week") },
    doubt,
  ];
}

/** A change to the plan wears the plan's neutral tone: it's about time, not a kind of lesson. */
function PlanChangeTile() {
  return (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
    >
      <CalendarCogIcon className="size-4" />
    </span>
  );
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
}: {
  buddy: LearnBuddy | null;
  decide: DecideTutorPlanChange;
  situation: TutorSituation;
  tools: TutorToolActions;
}): TutorConversationContent {
  const t = useExtracted();
  const identity = useTutorIdentity(buddy);
  const { name } = identity;
  const suggestions = useSuggestions(situation);

  // The hello says the buddy is an AI, since it opens every conversation (EU AI Act art. 50;
  // Decreto 12.880/2026 art. 11 for minors).
  const greeting = buddy
    ? t(
        "Hi! I'm {name}, your AI tutor. Ask me anything about what you're studying, or tell me what you'd like to change in your plan.",
        { name },
      )
    : t(
        "Hi! I'm your AI study buddy. Ask me anything about what you're studying, or tell me what you'd like to change in your plan. Pick my look and name whenever you like.",
      );

  return {
    composerLabel: t("Message {name}", { name }),
    greeting,
    identity,
    placeholder: t("Message {name}…", { name }),
    renderPlanChange: ({ change, onAnswered }) => (
      <TutorPlanChange change={change} decide={decide} onAnswered={onAnswered} />
    ),
    renderToolOffer: (offer) => <TutorToolOfferCard actions={tools} offer={offer} />,
    suggestions,
  };
}
