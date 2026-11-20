"use client";

import { useTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { AskTutor, AskTutorScope } from "@zoonk/player/tutor";

export type TutorViewer = {
  buddy: LessonTutorConfig["buddy"];
  canAsk: boolean;
  goalId: string | null;
};

function useMainTutor({ buddy, canAsk, goalId }: TutorViewer): LessonTutorConfig {
  const cards = useTutorCards(goalId);
  return useTutorConfig({ buddy, canAsk, cards });
}

/** Pages that render it need the learn catalog (`scope="learn"`). */
export function MainAskTutor({
  buddy,
  canAsk,
  goalId,
  ...props
}: Omit<React.ComponentProps<typeof AskTutor>, "tutor"> & TutorViewer) {
  const tutor = useMainTutor({ buddy, canAsk, goalId });
  return <AskTutor {...props} tutor={tutor} />;
}

/** One conversation for a page that places the tutor's entry more than once (`AskTutorEntry`). */
export function MainTutorScope({
  buddy,
  canAsk,
  children,
  goalId,
  target,
}: Omit<React.ComponentProps<typeof AskTutorScope>, "tutor"> & TutorViewer) {
  const tutor = useMainTutor({ buddy, canAsk, goalId });

  return (
    <AskTutorScope target={target} tutor={tutor}>
      {children}
    </AskTutorScope>
  );
}
