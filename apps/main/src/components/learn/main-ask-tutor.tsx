"use client";

import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { AskTutor } from "@zoonk/player/tutor";
import { useMemo } from "react";

/**
 * Who asks the tutor on a screen, the buddy who answers and the goal whose plan it reads and
 * changes there, as `getTutorViewer` reads them.
 */
export type TutorViewer = {
  buddy: LessonTutorConfig["buddy"];
  canAsk: boolean;
  goalId: string | null;
};

/**
 * "Ask" the learner's buddy on a learn screen, with main's tutor connection and links, so server
 * pages can place it with plain props (`buddy` from `getLearnerBuddy`). Inside a goal, its answers
 * show the plan changes and features the buddy offers, as on the buddy tab. Pages that render it
 * need the player's messages (`scope="player"`).
 */
export function MainAskTutor({
  buddy,
  canAsk,
  goalId,
  ...props
}: Omit<React.ComponentProps<typeof AskTutor>, "tutor"> & TutorViewer) {
  const cards = useTutorCards(goalId);
  const tutor = useMemo(() => getTutorConfig({ buddy, canAsk, cards }), [buddy, canAsk, cards]);
  return <AskTutor {...props} tutor={tutor} />;
}
