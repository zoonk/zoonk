"use client";

import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import { type QuestionTutor } from "@zoonk/learn/question-tutor";
import { getQuestionTutor } from "@zoonk/player/tutor/item";
import { useMemo } from "react";
import { type TutorViewer } from "./main-ask-tutor";

/**
 * The learner's buddy for a run of questions (a session's block, mistakes practice), with main's
 * tutor connection and links: the question in view is asked about in a drawer on phones and
 * tablets in portrait and docked in the aside from `lg`. Pages that use it need the player's
 * messages (`scope="player"`).
 */
export function useQuestionTutor({ buddy, canAsk, goalId }: TutorViewer): QuestionTutor {
  const cards = useTutorCards(goalId);
  const tutor = useMemo(() => getTutorConfig({ buddy, canAsk, cards }), [buddy, canAsk, cards]);
  return useMemo(() => getQuestionTutor(tutor), [tutor]);
}
