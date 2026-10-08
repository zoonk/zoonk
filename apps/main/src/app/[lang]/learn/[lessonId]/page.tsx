import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { FIRST_ANSWER_PARAM } from "@/lib/public/public-hrefs";
import { getLessonSessionContext } from "@/lib/session/lesson-session-context";
import { filterSkippedSteps } from "@zoonk/core/language/activities";
import { getLanguageActivitySettings } from "@zoonk/core/language/activities/skipped";
import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/contract";
import {
  type PlayableLibraryLessonResult,
  getLibraryLessonOutline,
  getPlayableLibraryLesson,
} from "@zoonk/core/lesson-player/get";
import { getLessonProgress } from "@zoonk/core/lesson-player/progress";
import { getLessonSupport } from "@zoonk/core/lesson-player/support";
import { getChallengeTeam } from "@zoonk/core/library/challenges/get-team";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { getLessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuestLessonPlayer } from "./guest-lesson-player";
import { LessonGuestGate } from "./lesson-guest-gate";
import { LessonPlayerClient, type LessonRouting } from "./lesson-player-client";
import { getLessonRouting } from "./lesson-routing";
import { LessonSlowDownView } from "./lesson-slow-down-view";
import { LessonWaitingView } from "./lesson-waiting-view";

type Props = PageProps<"/[lang]/learn/[lessonId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getLibraryLessonOutline({ lessonId });

  // The player is the app, not a page to find: the public lesson page is the one search indexes.
  return { robots: { follow: false, index: false }, title: lesson?.title };
}

function LessonPlayerSkeleton() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-3 py-2 sm:px-4 xl:py-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-12" />
        </div>
        <span className="size-9" />
      </header>
      <Skeleton className="h-1 w-full rounded-none" />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 lg:pt-10">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </section>
      <div className="mx-auto w-full max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </main>
  );
}

/**
 * The player's URL contract: the option a visitor picked on the public page's first screen, and
 * the study session the lesson is a block of.
 */
function readPlayerQuery(query: Awaited<Props["searchParams"]>) {
  const firstAnswer = query[FIRST_ANSWER_PARAM];
  const sessionParam = query[STUDY_SESSION_PARAM];

  return {
    firstAnswer: typeof firstAnswer === "string" ? firstAnswer : null,
    studySessionId: isUuid(sessionParam) ? sessionParam : null,
  };
}

/**
 * A language lesson without the practice the learner left out of their plan, and whether they can
 * skip more of it from the lesson ("Skip writing"). Other lessons play as they are.
 */
async function withLanguageActivities(lesson: PlayableLibraryLesson) {
  const { targetLanguage } = lesson;
  const settings = targetLanguage ? await getLanguageActivitySettings({ targetLanguage }) : null;

  if (!settings) {
    return { lesson, skippableLanguage: null };
  }

  return {
    lesson: {
      ...lesson,
      steps: filterSkippedSteps({ activities: settings.skipped, steps: lesson.steps }),
    },
    skippableLanguage: targetLanguage,
  };
}

/** A lesson with a challenge plays with the learner's team, kept with their plan. */
async function getLessonChallengeTeam(played: { lesson: PlayableLibraryLesson } | null) {
  const lesson = played?.lesson;

  if (!lesson?.steps.some((step) => step.kind === "challenge")) {
    return null;
  }

  const outcome = await getChallengeTeam({ lessonId: lesson.id });
  return outcome.status === "ready" ? outcome.team : null;
}

/**
 * A lesson whose screens aren't here yet: a visitor becomes a guest first, since screens load only
 * with a session, and a lesson still being written is written now, on a live screen. A visitor
 * presses "Start this lesson" before an unwritten lesson is written, so loading the page alone
 * never writes one.
 */
function LessonWithoutScreens({
  hasSession,
  inSession,
  result,
}: {
  hasSession: boolean;
  inSession: boolean;
  result: Exclude<PlayableLibraryLessonResult, { status: "ready" }>;
}) {
  if (result.status === "sessionRequired") {
    return <LessonGuestGate lesson={result.lesson} />;
  }

  if (result.status === "slowDown") {
    return <LessonSlowDownView retryAfterSeconds={result.retryAfterSeconds} />;
  }

  return <LessonWaitingView hasSession={hasSession} inSession={inSession} lesson={result.lesson} />;
}

const SESSION_ROUTING: LessonRouting = { exit: "/today", exitTo: null, nextLesson: null };

/**
 * Where the lesson closes to: a session block back to Today, a learner's lesson to its chapter
 * (with the next lesson there), and a guest's to where the default player sends it.
 */
async function getRouting({
  inSession,
  isGuest,
  lesson,
}: {
  inSession: boolean;
  isGuest: boolean;
  lesson: PlayableLibraryLesson | null;
}): Promise<LessonRouting | undefined> {
  if (inSession) {
    return SESSION_ROUTING;
  }

  if (isGuest || !lesson) {
    return undefined;
  }

  return getLessonRouting({ chapterId: lesson.chapter?.id ?? null, lessonId: lesson.id });
}

async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const { firstAnswer, studySessionId } = readPlayerQuery(query);

  const [result, session, profile, fit, sessionContext, support, resume, tutor] = await Promise.all(
    [
      getPlayableLibraryLesson({ lessonId }),
      getSession(),
      getLearningProfile(),
      getLessonFit({ lessonId }),
      getLessonSessionContext(studySessionId),
      getLessonSupport({ lessonId }),
      getLessonProgress({ lessonId }),
      getTutorViewer(),
    ],
  );

  /**
   * Screens need a session, so visitors from a public page become guests before the lesson opens
   * (`LessonGuestGate`); outside a study session, a guest's lesson ends with a way to keep it. A
   * guest's session lessons keep the session's moments.
   */
  const isGuest = Boolean(session?.user.isAnonymous) && studySessionId === null;
  /** Sounds stay on until the learner turns them off in Appearance. */
  const soundsEnabled = profile?.soundsEnabled ?? true;

  const played = result?.status === "ready" ? await withLanguageActivities(result.lesson) : null;

  const [challengeTeam, routing] = await Promise.all([
    getLessonChallengeTeam(played),
    getRouting({ inSession: sessionContext !== null, isGuest, lesson: played?.lesson ?? null }),
  ]);

  if (!result) {
    notFound();
  }

  return (
    <>
      {result.status === "ready" && isGuest && (
        <GuestLessonPlayer
          challengeTeam={challengeTeam}
          firstAnswer={firstAnswer}
          fit={fit}
          hasSession={Boolean(session)}
          lesson={result.lesson}
          resume={resume}
          soundsEnabled={soundsEnabled}
          studySessionId={null}
          support={support}
        />
      )}

      {played && !isGuest && (
        <LessonPlayerClient
          challengeTeam={challengeTeam}
          firstAnswer={firstAnswer}
          hasSession={Boolean(session)}
          lesson={played.lesson}
          resume={resume}
          routing={routing}
          sessionContext={sessionContext}
          skippableLanguage={played.skippableLanguage}
          soundsEnabled={soundsEnabled}
          studySessionId={studySessionId}
          support={support}
          tutor={tutor}
        />
      )}

      {result.status !== "ready" && (
        <LessonWithoutScreens
          hasSession={Boolean(session)}
          inSession={studySessionId !== null}
          result={result}
        />
      )}
    </>
  );
}

/** Plays a Library lesson full screen, with no navigation bar. */
export default function LearnLessonPage(props: Props) {
  return (
    <Suspense fallback={<LessonPlayerSkeleton />}>
      <LessonPlayerContent {...props} />
    </Suspense>
  );
}
