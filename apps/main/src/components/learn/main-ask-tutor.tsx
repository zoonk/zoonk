"use client";

import { getTutorConfig } from "@/lib/learn/tutor-config";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { AskTutor } from "@zoonk/player/tutor";
import { useMemo } from "react";

/** Who asks the tutor on a screen and the buddy who answers, as `getTutorViewer` reads them. */
export type TutorViewer = { buddy: LessonTutorConfig["buddy"]; canAsk: boolean };

/**
 * "Ask" the learner's buddy on a learn screen, with main's tutor connection and links, so server
 * pages can place it with plain props (`buddy` from `getLearnerBuddy`). Pages that render it need
 * the player's messages (`scope="player"`).
 */
export function MainAskTutor({
  buddy,
  canAsk,
  ...props
}: Omit<React.ComponentProps<typeof AskTutor>, "tutor"> & TutorViewer) {
  const tutor = useMemo(() => getTutorConfig({ buddy, canAsk }), [buddy, canAsk]);
  return <AskTutor {...props} tutor={tutor} />;
}
