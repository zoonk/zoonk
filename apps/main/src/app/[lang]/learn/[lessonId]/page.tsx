import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { readLessonWritingRequest } from "@/lib/lessons/lesson-writing-href";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { FIRST_ANSWER_PARAM, ORIGIN_PARAM, readCatalogOrigin } from "@/lib/public/public-hrefs";
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
import { collectMathMarkup } from "@zoonk/learn/rich-text/math";
import { MathMarkupProvider } from "@zoonk/learn/rich-text/math-provider";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { wordTutorSuggestions } from "@zoonk/player/tutor/suggestion-words";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuestLessonPlayer } from "./guest-lesson-player";
import { LessonGuestGate } from "./lesson-guest-gate";
import { LessonPlayerClient, type LessonRouting } from "./lesson-player-client";
import { getLessonRouting } from "./lesson-routing";
import { LessonWaitingView } from "./lesson-waiting-view";

type Props = PageProps<"/[lang]/learn/[lessonId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getLibraryLessonOutline({ lessonId });

  // The player is the app, not a page to find: the public lesson page is the one search indexes.
  return { robots: { follow: false, index: false }, title: lesson?.title };
}

/**
 * The player's own shape (its header with the lesson's segments, a screen in the column, the
 * action bar, and the aside beside them from `lg`), so nothing moves when the lesson arrives.
 */
function LessonPlayerSkeleton() {
  return (
    <TaskSkeleton aside menu progress title={<Skeleton className="h-4 w-40" />}>
      <Skeleton className="h-7 w-3/4" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </TaskSkeleton>
  );
}

/**
 * The player's URL contract: the option a visitor picked on the public page's first screen, the
 * catalog page they opened the lesson from, and the study session the lesson is a block of.
 */
function readPlayerQuery(query: Awaited<Props["searchParams"]>) {
  const firstAnswer = query[FIRST_ANSWER_PARAM];
  const sessionParam = query[STUDY_SESSION_PARAM];

  return {
    firstAnswer: typeof firstAnswer === "string" ? firstAnswer : null,
    origin: readCatalogOrigin(query[ORIGIN_PARAM]),
    studySessionId: isUuid(sessionParam) ? sessionParam : null,
  };
}

/**
 * A language lesson without the practice left out in Plan settings. Temporary writing skips
 * belong to the current player sitting and never change these preferences.
 */
async function withLanguageActivities(lesson: PlayableLibraryLesson) {
  const { targetLanguage } = lesson;
  const settings = targetLanguage ? await getLanguageActivitySettings({ targetLanguage }) : null;

  if (!settings) {
    return { lesson };
  }

  return {
    lesson: {
      ...lesson,
      steps: filterSkippedSteps({ activities: settings.skipped, steps: lesson.steps }),
    },
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
  inSession,
  initialRequest,
  origin,
  result,
}: {
  inSession: boolean;
  initialRequest: LessonRequest;
  origin: string | null;
  result: Exclude<PlayableLibraryLessonResult, { status: "ready" }>;
}) {
  if (result.status === "sessionRequired") {
    return <LessonGuestGate exitHref={origin ?? "/"} lesson={result.lesson} />;
  }

  return (
    <LessonWaitingView
      inSession={inSession}
      initialRequest={initialRequest}
      lesson={result.lesson}
      origin={origin}
    />
  );
}

const SESSION_ROUTING: LessonRouting = { exit: "/today", exitTo: null, nextLesson: null };

/**
 * Where the lesson closes to: a session block back to Today, a learner's lesson to its chapter
 * in their plan (with the next lesson there), and otherwise back to the catalog page it was opened
 * from (a guest who tried it on a course's page returns there), or where the default player
 * sends it.
 */
async function getRouting({
  inSession,
  isGuest,
  lesson,
  origin,
}: {
  inSession: boolean;
  isGuest: boolean;
  lesson: PlayableLibraryLesson | null;
  origin: string | null;
}): Promise<LessonRouting | undefined> {
  if (inSession) {
    return SESSION_ROUTING;
  }

  const fromPage = origin ? { exit: origin, exitTo: null, nextLesson: null } : undefined;

  if (isGuest || !lesson) {
    return fromPage;
  }

  const routing = await getLessonRouting({
    chapterId: lesson.chapter?.id ?? null,
    lessonId: lesson.id,
  });

  return routing.exitTo === null && fromPage ? fromPage : routing;
}

async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const { firstAnswer, origin, studySessionId } = readPlayerQuery(query);

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

  const [challengeTeam, routing, tutorSuggestions] = await Promise.all([
    getLessonChallengeTeam(played),
    getRouting({
      inSession: sessionContext !== null,
      isGuest,
      lesson: played?.lesson ?? null,
      origin,
    }),
    played ? wordTutorSuggestions(played.lesson.language) : [],
  ]);

  if (!result) {
    notFound();
  }

  // Every screen's formulas drawn here, so the player shows them without loading KaTeX.
  const mathMarkup = collectMathMarkup(played?.lesson);

  return (
    <MathMarkupProvider markup={mathMarkup}>
      {result.status === "ready" && isGuest && (
        <GuestLessonPlayer
          challengeTeam={challengeTeam}
          firstAnswer={firstAnswer}
          fit={fit}
          hasSession={Boolean(session)}
          lesson={result.lesson}
          resume={resume}
          routing={routing}
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
          soundsEnabled={soundsEnabled}
          studySessionId={studySessionId}
          support={support}
          tutor={tutor}
          tutorSuggestions={tutorSuggestions}
        />
      )}

      {result.status !== "ready" && (
        <LessonWithoutScreens
          inSession={studySessionId !== null}
          initialRequest={readLessonWritingRequest(query)}
          origin={origin}
          result={result}
        />
      )}
    </MathMarkupProvider>
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
