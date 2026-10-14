"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { type ComponentProps } from "react";
import { type DecideTutorPlanChange, type TutorPlanChange } from "./tutor-plan-change";
import { type TutorToolActions, type TutorToolOfferCard } from "./tutor-tool-offer";

/**
 * The cards are their own chunks: only a conversation whose answers carry one loads them
 * (`preloadTutorCards`), and a card shows as soon as its code is here.
 */
const planChangeCard = createOnDemand(() => import("./tutor-plan-change"));
const toolOfferCard = createOnDemand(() => import("./tutor-tool-offer"));

/** Starts loading the cards' code, for a conversation whose answers carry a card. */
export function preloadTutorCards() {
  void planChangeCard.load();
  void toolOfferCard.load();
}

function PlanChangeCard(props: ComponentProps<typeof TutorPlanChange>) {
  const card = planChangeCard.useModule();

  if (!card) {
    return null;
  }

  const Card = card.TutorPlanChange;

  return <Card {...props} />;
}

function ToolOfferCard(props: ComponentProps<typeof TutorToolOfferCard>) {
  const card = toolOfferCard.useModule();

  if (!card) {
    return null;
  }

  const Card = card.TutorToolOfferCard;

  return <Card {...props} />;
}

/**
 * The cards under the buddy's answers, wherever the learner asks it (its tab, a chapter, a lesson
 * or a mock): a plan change it proposed, with Apply, and an app feature it offered, with its button.
 */
export type TutorCards = {
  renderPlanChange: (input: {
    change: PlanChangeView;
    onAnswered: (change: PlanChangeView) => void;
  }) => React.ReactNode;
  renderToolOffer: (offer: TutorToolOffer) => React.ReactNode;
};

/** How the host saves the learner's answer to a plan change and opens an offered feature. */
export type TutorCardActions = { decide: DecideTutorPlanChange; tools: TutorToolActions };

export function getTutorCards({ decide, tools }: TutorCardActions): TutorCards {
  return {
    renderPlanChange: ({ change, onAnswered }) => (
      <PlanChangeCard change={change} decide={decide} onAnswered={onAnswered} />
    ),
    renderToolOffer: (offer) => <ToolOfferCard actions={tools} offer={offer} />,
  };
}
