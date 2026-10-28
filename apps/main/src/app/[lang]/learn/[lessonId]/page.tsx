import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { readLessonWritingRequest } from "@/lib/lessons/lesson-writing-href";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { FIRST_ANSWER_PARAM, ORIGIN_PARAM, readCatalogOrigin } from "@/lib/public/public-hrefs";
import { getLessonSessionContext } from "@/lib/session/lesson-session-context";
import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/contract";
import {
  type PlayableLibraryLessonResult,
  getLibraryLessonOutline,
  getPlayableLibraryLesson,
} from "@zoonk/core/lesson-player/get";
import { getLessonProgress } from "@zoonk/core/lesson-player/progress";
import { getLessonSupport } from "@zoonk/core/lesson-player/support";
import { getChallengeTeam } from "@zoonk/core/library/challenges/get-team";
import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
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

/** A lesson with a challenge plays with the learner's team, kept with their plan. */
async function getLessonChallengeTeam(played: { lesson: PlayableLibraryLesson } | null) {
  const lesson = played?.lesson;

  if (!lesson?.steps.some((step) => step.kind === "challenge")) {
    return null;
  }

  const outcome = await getChallengeTeam({ lessonId: lesson.id });
  return outcome.status === "ready" ? outcome.team : null;
}

/** Where a lesson not written yet stands; read only for one. */
async function loadWaitingState(result: PlayableLibraryLessonResult | null) {
  return result?.status === "notGenerated"
    ? getLessonWaitingState({ lessonId: result.lesson.id })
    : null;
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
  waiting,
}: {
  inSession: boolean;
  initialRequest: LessonRequest;
  origin: string | null;
  result: Exclude<PlayableLibraryLessonResult, { status: "ready" }>;
  waiting: Awaited<ReturnType<typeof loadWaitingState>>;
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
      waiting={waiting}
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

/**
 * Screens need a session, so visitors from a public page become guests before the lesson opens
 * (`LessonGuestGate`); outside a study session, a guest's lesson ends with a way to keep it. A
 * guest's session lessons keep the session's moments.
 */
function isGuestLesson({
  session,
  studySessionId,
}: {
  session: Awaited<ReturnType<typeof getSession>>;
  studySessionId: string | null;
}): boolean {
  return Boolean(session?.user.isAnonymous) && studySessionId === null;
}

/**
 * A missing task's message is left to the browser here, unlike other task pages (`NotFoundPage`):
 * drawing the task's frame on the server too makes this page's scripts carry the frame's code
 * twice, about 11 KB more on every visit.
 */
async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const { firstAnswer, origin, studySessionId } = readPlayerQuery(query);

  const lessonRead = getPlayableLibraryLesson({ lessonId });
  const sessionRead = getSession();
  const sessionContextRead = getLessonSessionContext(studySessionId);

  // What the lesson itself decides is read as soon as the lesson is, beside the other reads.
  const lessonDetailsRead = lessonRead.then((lessonResult) => {
    const lesson = lessonResult?.status === "ready" ? lessonResult.lesson : null;

    return Promise.all([
      getLessonChallengeTeam(lesson && { lesson }),
      lesson ? wordTutorSuggestions(lesson.language) : [],
      loadWaitingState(lessonResult),
    ]);
  });

  const routingRead = Promise.all([lessonRead, sessionRead, sessionContextRead]).then(
    ([lessonResult, lessonSession, context]) =>
      getRouting({
        inSession: context !== null,
        isGuest: isGuestLesson({ session: lessonSession, studySessionId }),
        lesson: lessonResult?.status === "ready" ? lessonResult.lesson : null,
        origin,
      }),
  );

  const [
    result,
    session,
    profile,
    fit,
    sessionContext,
    support,
    resume,
    tutor,
    [challengeTeam, tutorSuggestions, waiting],
    routing,
  ] = await Promise.all([
    lessonRead,
    sessionRead,
    getLearningProfile(),
    getLessonFit({ lessonId }),
    sessionContextRead,
    getLessonSupport({ lessonId }),
    getLessonProgress({ lessonId }),
    getTutorViewer(),
    lessonDetailsRead,
    routingRead,
  ]);

  const isGuest = isGuestLesson({ session, studySessionId });
  /** Sounds stay on until the learner turns them off in Appearance. */
  const soundsEnabled = profile?.soundsEnabled ?? true;

  const played = result?.status === "ready" ? { lesson: result.lesson } : null;

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
          tutor={tutor}
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
          waiting={waiting}
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
