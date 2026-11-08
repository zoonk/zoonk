"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useRouter } from "@/i18n/navigation";
import { getCompletionLessonHref } from "@/lib/session/lesson-opening";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { LessonMoment, LessonMomentHeader } from "@zoonk/learn/session/lesson-moment";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { useEffect, useMemo } from "react";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/** The session screen's frame is static, so Continue opens the next block there at once. */
export function useLessonSessionSlots({
  buddy,
  inSession,
}: {
  buddy: LearnBuddy | null;
  inSession: boolean;
}): Pick<LessonPlayerSlots, "completion" | "completionHeader"> | null {
  const router = useRouter();

  useEffect(() => {
    if (inSession) {
      router.prefetch("/session");
    }
  }, [inSession, router]);

  return useMemo(() => {
    if (!inSession) {
      return null;
    }

    return {
      // The player sits outside the learning tabs, so the moment brings main's adapters along.
      completion: ({ completion, onRetry }) => (
        <MainLearnProvider>
          <SessionLessonMoment buddy={buddy} completion={completion} onRetry={onRetry} />
        </MainLearnProvider>
      ),
      completionHeader: ({ completion, menu }) =>
        completion.result?.studyBlock ? (
          <MainLearnProvider>
            <LessonMomentHeader completion={completion} exitHref="/today" menu={menu} />
          </MainLearnProvider>
        ) : null,
    };
  }, [buddy, inSession]);
}

function SessionLessonMoment({
  buddy,
  completion,
  onRetry,
}: {
  buddy: LearnBuddy | null;
  completion: Parameters<NonNullable<LessonPlayerSlots["completion"]>>[0]["completion"];
  onRetry: () => void;
}) {
  const moment = completion.result?.studyBlock;
  const navigation = useStudyNavigation(moment?.sessionId ?? "");
  const startTestOut = useStartTestOut();

  return (
    <LessonMoment
      buddy={buddy}
      completion={completion}
      continueHref={moment ? getCompletionLessonHref(moment) : null}
      onContinue={navigation.continueSession}
      onRetry={onRetry}
      onStartTestOut={(chapterId) =>
        moment?.goalId
          ? startTestOut({ chapterId, fromSession: true, goalId: moment.goalId })
          : Promise.resolve({ status: "failed" })
      }
      onStop={navigation.stop}
    />
  );
}
