"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { LessonMoment, LessonMomentHeader } from "@zoonk/learn/session/lesson-moment";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { useMemo } from "react";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/**
 * A lesson played as one of today's blocks: the session's completion moment, whose Continue opens
 * the next block, under the session's header (the day as one segment per block) in place of the
 * lesson's once the lesson is saved, like between every other block. Null for a lesson on its own.
 */
export function useLessonSessionSlots({
  session,
}: {
  session: LessonSessionContext | null;
}): Pick<LessonPlayerSlots, "completion" | "completionHeader"> | null {
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
      // Until the lesson is saved there's no moment yet, and the lesson's header stays.
      completionHeader: ({ completion }) =>
        completion.result?.studyBlock ? (
          <MainLearnProvider>
            <LessonMomentHeader completion={completion} exitHref="/today" />
          </MainLearnProvider>
        ) : null,
    };
  }, [navigation, session, startTestOut]);
}
