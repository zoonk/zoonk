"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type DecideTutorPlanChange, TutorPlanChange } from "./tutor-plan-change";
import { type TutorToolActions, TutorToolOfferCard } from "./tutor-tool-offer";

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
      <TutorPlanChange change={change} decide={decide} onAnswered={onAnswered} />
    ),
    renderToolOffer: (offer) => <TutorToolOfferCard actions={tools} offer={offer} />,
  };
}
