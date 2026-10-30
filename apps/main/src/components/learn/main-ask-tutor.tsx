"use client";

import { useTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { AskTutor } from "@zoonk/player/tutor";

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
  const tutor = useTutorConfig({ buddy, canAsk, cards });
  return <AskTutor {...props} tutor={tutor} />;
}
