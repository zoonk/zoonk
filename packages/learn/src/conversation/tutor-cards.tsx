"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { type ComponentProps } from "react";
import { type DecideTutorPlanChange, type TutorPlanChange } from "./tutor-plan-change";
import { type TutorToolActions, type TutorToolOfferCard } from "./tutor-tool-offer";

const planChangeCard = createOnDemand(() => import("./tutor-plan-change"));
const toolOfferCard = createOnDemand(() => import("./tutor-tool-offer"));

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

export type TutorCards = {
  renderPlanChange: (input: {
    change: PlanChangeView;
    onAnswered: (change: PlanChangeView) => void;
  }) => React.ReactNode;
  renderToolOffer: (offer: TutorToolOffer) => React.ReactNode;
};

export type TutorCardActions = { decide: DecideTutorPlanChange; tools: TutorToolActions };

export function getTutorCards({ decide, tools }: TutorCardActions): TutorCards {
  return {
    renderPlanChange: ({ change, onAnswered }) => (
      <PlanChangeCard change={change} decide={decide} onAnswered={onAnswered} />
    ),
    renderToolOffer: (offer) => <ToolOfferCard actions={tools} offer={offer} />,
  };
}
