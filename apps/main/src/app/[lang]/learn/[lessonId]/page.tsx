import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
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
import { getLessonSupport } from "@zoonk/core/lesson-player/support";
import { getChallengeTeam } from "@zoonk/core/library/challenges/get-team";
import { type LearningProfileView } from "@zoonk/core/profile/contract";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { getLessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuestLessonPlayer } from "./guest-lesson-player";
import { LessonGuestGate } from "./lesson-guest-gate";
import { LessonPlayerClient } from "./lesson-player-client";
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
    <DeviceModeRoot>
      <main className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-3 py-2 sm:px-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <span className="size-9" />
        </header>
        <Skeleton className="h-1 w-full rounded-none" />
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </section>
        <div className="mx-auto w-full max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </main>
    </DeviceModeRoot>
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

/** How the learner's profile sets up the player: sounds on and the base version unless they chose. */
function toPlayerPreferences(profile: LearningProfileView | null) {
  return {
    deeperByDefault: profile?.deeperByDefault ?? false,
    soundsEnabled: profile?.soundsEnabled ?? true,
  };
}

async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const { firstAnswer, studySessionId } = readPlayerQuery(query);

  const [result, session, profile, mode, buddy, fit, sessionContext, support] = await Promise.all([
    getPlayableLibraryLesson({ lessonId }),
    getSession(),
    getLearningProfile(),
    getExperienceMode(),
    getLearnerBuddy(),
    getLessonFit({ lessonId }),
    getLessonSessionContext(studySessionId),
    getLessonSupport({ lessonId }),
  ]);

  const played = result?.status === "ready" ? await withLanguageActivities(result.lesson) : null;
  const challengeTeam = await getLessonChallengeTeam(played);

  /**
   * Screens need a session, so visitors from a public page become guests before the lesson opens
   * (`LessonGuestGate`); outside a study session, a guest's lesson ends with a way to keep it. A
   * guest's session lessons keep the session's moments.
   */
  const isGuest = Boolean(session?.user.isAnonymous) && studySessionId === null;
  const preferences = toPlayerPreferences(profile);

  if (!result) {
    notFound();
  }

  return (
    <ModeProvider experienceMode={mode}>
      {result.status === "ready" && isGuest && (
        <GuestLessonPlayer
          canAskTutor={false}
          challengeTeam={challengeTeam}
          firstAnswer={firstAnswer}
          fit={fit}
          hasSession={Boolean(session)}
          lesson={result.lesson}
          buddy={buddy}
          soundsEnabled={preferences.soundsEnabled}
          studySessionId={null}
          support={support}
        />
      )}

      {played && !isGuest && (
        <LessonPlayerClient
          canAskTutor={Boolean(session && !session.user.isAnonymous)}
          challengeTeam={challengeTeam}
          deeperByDefault={preferences.deeperByDefault}
          firstAnswer={firstAnswer}
          hasSession={Boolean(session)}
          lesson={played.lesson}
          buddy={buddy}
          sessionContext={sessionContext}
          skippableLanguage={played.skippableLanguage}
          soundsEnabled={preferences.soundsEnabled}
          studySessionId={studySessionId}
          support={support}
        />
      )}

      {result.status !== "ready" && (
        <LessonWithoutScreens
          hasSession={Boolean(session)}
          inSession={studySessionId !== null}
          result={result}
        />
      )}
    </ModeProvider>
  );
}

/** Plays a Library lesson full screen, with no navigation bar, in the learner's mode. */
export default function LearnLessonPage(props: Props) {
  return (
    <Suspense fallback={<LessonPlayerSkeleton />}>
      <LessonPlayerContent {...props} />
    </Suspense>
  );
}
