import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { readLessonWritingRequest } from "@/lib/lessons/lesson-writing-href";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import {
  FIRST_ANSWER_PARAM,
  type LessonOrigin,
  ORIGIN_PARAM,
  readLessonOrigin,
} from "@/lib/public/public-hrefs";
import { readLessonOpening } from "@/lib/session/lesson-opening";
import { getActiveGoalId } from "@zoonk/core/goals/active-goal";
import { getFinishedLessonStudyBlock } from "@zoonk/core/lesson-player/finished-study-block";
import {
  type PlayableLibraryLessonResult,
  getLibraryLessonOutline,
  getPlayableLibraryLesson,
} from "@zoonk/core/lesson-player/get";
import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/playable-lesson";
import { getLessonProgress } from "@zoonk/core/lesson-player/progress";
import { getChallengeTeam } from "@zoonk/core/library/challenges/get-team";
import { getWarmUp } from "@zoonk/core/library/warm-ups/get";
import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { getLessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { collectMathMarkup } from "@zoonk/learn/rich-text/math";
import { MathMarkupProvider } from "@zoonk/learn/rich-text/math-provider";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { wordTutorSuggestions } from "@zoonk/player/tutor/suggestion-words";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { safeAsync } from "@zoonk/utils/error";
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

function readPlayerQuery(query: Awaited<Props["searchParams"]>) {
  const firstAnswer = query[FIRST_ANSWER_PARAM];
  const sessionParam = query[STUDY_SESSION_PARAM];

  const opening = readLessonOpening(query);

  const blockId =
    opening && opening !== "invalid" && !("goalId" in opening) && opening.target.kind !== "next"
      ? opening.target.blockId
      : undefined;

  return {
    blockId,
    firstAnswer: typeof firstAnswer === "string" ? firstAnswer : null,
    inSession: opening !== null || isUuid(sessionParam),
    opening,
    origin: readLessonOrigin(query[ORIGIN_PARAM]),
    studySessionId: isUuid(sessionParam) ? sessionParam : null,
  };
}

async function getLessonChallengeTeam(played: { lesson: PlayableLibraryLesson } | null) {
  const lesson = played?.lesson;

  if (!lesson?.steps.some((step) => step.kind === "challenge")) {
    return null;
  }

  const outcome = await getChallengeTeam({ lessonId: lesson.id });
  return outcome.status === "ready" ? outcome.team : null;
}

/** The goal's first lesson's warm-up deck is read with the page, so its card paints with it. */
async function loadWaiting(result: PlayableLibraryLessonResult | null) {
  const waiting =
    result?.status === "notGenerated"
      ? await getLessonWaitingState({ lessonId: result.lesson.id })
      : null;

  const warmUpId = waiting?.status === "ready" ? waiting.state.warmUpId : null;

  // The card is optional: a deck that can't be read leaves the wait without it.
  const { data: warmUp } = warmUpId ? await safeAsync(() => getWarmUp(warmUpId)) : { data: null };

  return { waiting, warmUp: warmUp?.status === "ready" ? warmUp.deck : null };
}

function LessonWithoutScreens({
  goalId,
  inSession,
  initialRequest,
  origin,
  result,
  waiting,
}: {
  goalId: string | null;
  inSession: boolean;
  initialRequest: LessonRequest;
  origin: LessonOrigin | null;
  result: Exclude<PlayableLibraryLessonResult, { status: "ready" }>;
  waiting: Awaited<ReturnType<typeof loadWaiting>>;
}) {
  if (result.status === "sessionRequired") {
    return <LessonGuestGate exitHref={origin?.path ?? "/"} lesson={result.lesson} />;
  }

  return (
    <LessonWaitingView
      goalId={goalId}
      inSession={inSession}
      initialRequest={initialRequest}
      lesson={result.lesson}
      origin={origin?.path ?? null}
      waiting={waiting.waiting}
      warmUp={waiting.warmUp}
    />
  );
}

const SESSION_ROUTING: LessonRouting = { exit: "/today", exitTo: null, nextLesson: null };

/** A catalog page is gone back to only for a lesson without a chapter; an app place always. */
async function getRouting({
  inSession,
  isGuest,
  lesson,
  origin,
}: {
  inSession: boolean;
  isGuest: boolean;
  lesson: PlayableLibraryLesson | null;
  origin: LessonOrigin | null;
}): Promise<LessonRouting | undefined> {
  if (inSession) {
    return SESSION_ROUTING;
  }

  const fromPage = origin ? { exit: origin.path, exitTo: null, nextLesson: null } : undefined;

  if (isGuest || !lesson || origin?.kind === "app") {
    return fromPage;
  }

  const routing = await getLessonRouting({
    chapterId: lesson.chapter?.id ?? null,
    lessonId: lesson.id,
  });

  return routing.exitTo === null && fromPage ? fromPage : routing;
}

/**
 * The visitor's ending ("Build my plan") is only for a lesson opened from a public catalog page; a
 * guest who opened it inside the app (Today, Completed lessons, their chapters) already has a goal.
 */
function isGuestLesson({
  origin,
  session,
  studySessionId,
}: {
  origin: LessonOrigin | null;
  session: Awaited<ReturnType<typeof getSession>>;
  studySessionId: string | null;
}): boolean {
  return (
    Boolean(session?.user.isAnonymous) && studySessionId === null && origin?.kind === "catalog"
  );
}

/**
 * A missing task's message is left to the browser here: drawing the task's frame on the server too
 * makes this page's scripts carry the frame's code twice, about 11 KB more on every visit.
 */
async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);

  const { blockId, firstAnswer, inSession, opening, origin, studySessionId } =
    readPlayerQuery(query);

  const lessonRead = getPlayableLibraryLesson({ lessonId });
  const sessionRead = getSession();

  const finishedBlockRead = getFinishedLessonStudyBlock({
    blockId,
    lessonId,
    sessionId: studySessionId,
  });

  const lessonDetailsRead = lessonRead.then((lessonResult) => {
    const lesson = lessonResult?.status === "ready" ? lessonResult.lesson : null;

    return Promise.all([
      getLessonChallengeTeam(lesson && { lesson }),
      lesson ? wordTutorSuggestions(lesson.language) : [],
      loadWaiting(lessonResult),
    ]);
  });

  const routingRead = Promise.all([lessonRead, sessionRead]).then(([lessonResult, lessonSession]) =>
    getRouting({
      inSession,
      isGuest: isGuestLesson({ origin, session: lessonSession, studySessionId }),
      lesson: lessonResult?.status === "ready" ? lessonResult.lesson : null,
      origin,
    }),
  );

  const [
    result,
    session,
    profile,
    goalId,
    fit,
    finishedBlockId,
    resume,
    tutor,
    [challengeTeam, tutorSuggestions, waiting],
    routing,
  ] = await Promise.all([
    lessonRead,
    sessionRead,
    getLearningProfile(),
    getActiveGoalId(),
    getLessonFit({ lessonId }),
    finishedBlockRead,
    getLessonProgress({ lessonId }),
    getTutorViewer(),
    lessonDetailsRead,
    routingRead,
  ]);

  const isGuest = isGuestLesson({ origin, session, studySessionId });
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
          learnerId={session?.user.id ?? null}
          lesson={result.lesson}
          resume={resume}
          routing={routing}
          soundsEnabled={soundsEnabled}
          studySessionId={null}
          tutor={tutor}
        />
      )}

      {played && !isGuest && (
        <LessonPlayerClient
          goalId={goalId}
          challengeTeam={challengeTeam}
          firstAnswer={firstAnswer}
          learnerId={session?.user.id ?? null}
          lesson={played.lesson}
          resume={resume}
          routing={routing}
          finishedBlockId={finishedBlockId}
          opening={opening}
          soundsEnabled={soundsEnabled}
          studySessionId={studySessionId}
          tutor={tutor}
          tutorSuggestions={tutorSuggestions}
        />
      )}

      {result.status !== "ready" && (
        <LessonWithoutScreens
          goalId={goalId}
          inSession={inSession}
          initialRequest={readLessonWritingRequest(query)}
          origin={origin}
          result={result}
          waiting={waiting}
        />
      )}
    </MathMarkupProvider>
  );
}

export default function LearnLessonPage(props: Props) {
  return (
    <Suspense fallback={<LessonPlayerSkeleton />}>
      <LessonPlayerContent {...props} />
    </Suspense>
  );
}
