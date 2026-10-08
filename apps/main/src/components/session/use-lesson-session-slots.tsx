"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { LessonMoment } from "@zoonk/learn/session/lesson-moment";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { useMemo } from "react";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/**
 * A lesson played as one of today's blocks: the session's completion moment, whose Continue opens
 * the next block. The session's progress shows there, never under the player's header, so the
 * lesson keeps one bar. Null for a lesson on its own.
 */
export function useLessonSessionSlots({
  session,
}: {
  session: LessonSessionContext | null;
}): Pick<LessonPlayerSlots, "completion"> | null {
  const navigation = useStudyNavigation(session?.id ?? "");
  const startTestOut = useStartTestOut();

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
            onContinue={navigation.continueSession}
            onRetry={onRetry}
            onStartTestOut={(chapterId) =>
              session.goalId
                ? startTestOut({ chapterId, fromSession: true, goalId: session.goalId })
                : Promise.resolve({ status: "failed" })
            }
            onStop={navigation.stop}
            session={session}
          />
        </MainLearnProvider>
      ),
    };
  }, [navigation, session, startTestOut]);
}
