"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useRouter } from "@/i18n/navigation";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { LessonMoment, LessonMomentHeader } from "@zoonk/learn/session/lesson-moment";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { useEffect, useMemo } from "react";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/**
 * A lesson played as one of today's blocks: the session's completion moment, whose Continue opens
 * the next block, under the session's header (the day as one segment per block) in place of the
 * lesson's once the lesson is saved, like between every other block, with the learner's buddy
 * cheering a mission it completed. Null for a lesson on its own. The session screen's frame is
 * static: holding it, Continue opens the next block there at once.
 */
export function useLessonSessionSlots({
  buddy,
  session,
}: {
  buddy: LearnBuddy | null;
  session: LessonSessionContext | null;
}): Pick<LessonPlayerSlots, "completion" | "completionHeader"> | null {
  const navigation = useStudyNavigation(session?.id ?? "");
  const startTestOut = useStartTestOut();
  const router = useRouter();
  const inSession = session !== null;

  useEffect(() => {
    if (inSession) {
      router.prefetch("/session");
    }
  }, [inSession, router]);

  return useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      // The player sits outside the learning tabs, so the moment brings main's adapters along.
      completion: ({ completion, onRetry }) => (
        <MainLearnProvider>
          <LessonMoment
            buddy={buddy}
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
      completionHeader: ({ completion, menu }) =>
        completion.result?.studyBlock ? (
          <MainLearnProvider>
            <LessonMomentHeader completion={completion} exitHref="/today" menu={menu} />
          </MainLearnProvider>
        ) : null,
    };
  }, [buddy, navigation, session, startTestOut]);
}
