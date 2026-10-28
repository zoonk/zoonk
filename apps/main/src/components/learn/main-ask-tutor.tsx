"use client";

import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { AskTutor } from "@zoonk/player/tutor";
import { useMemo } from "react";

export type TutorViewer = {
  buddy: LessonTutorConfig["buddy"];
  canAsk: boolean;
  goalId: string | null;
};

/** Pages that render it need the learn catalog (`scope="learn"`). */
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
