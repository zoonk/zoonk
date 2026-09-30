"use client";

import { LESSON_FEEDBACK_SLOTS } from "@/components/feedback/lesson-feedback-slots";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { SessionBar } from "@zoonk/learn/session/bar";
import { LessonMoment } from "@zoonk/learn/session/lesson-moment";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { useMemo } from "react";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/**
 * A lesson played as one of today's blocks: the session bar under the player's header and the
 * session's completion moment, whose Continue opens the next block. Null for a lesson on its own.
 */
export function useLessonSessionSlots({
  lessonId,
  session,
}: {
  lessonId: string;
  session: LessonSessionContext | null;
}): Pick<LessonPlayerSlots, "completion" | "sessionBar"> | null {
  const navigation = useStudyNavigation(session?.id ?? "");

  return useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      // The player sits outside the learning tabs, so the moment brings main's adapters along.
      completion: ({ completion, onRetry }) => (
        <MainLearnProvider>
          <LessonMoment
            completion={completion}
            feedback={LESSON_FEEDBACK_SLOTS.completionFeedback?.({
              contentId: lessonId,
              contentKind: "lesson",
            })}
            onContinue={navigation.continueSession}
            onRetry={onRetry}
            onStop={navigation.stop}
            session={session}
          />
        </MainLearnProvider>
      ),
      sessionBar: (
        <SessionBar
          className="mx-auto max-w-2xl px-4 pt-2"
          completed={session.sessionBar.completed}
          total={session.sessionBar.total}
        />
      ),
    };
  }, [lessonId, navigation, session]);
}
