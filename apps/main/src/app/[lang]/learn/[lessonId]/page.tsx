import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { readLessonWritingRequest } from "@/lib/lessons/lesson-writing-href";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { FIRST_ANSWER_PARAM, ORIGIN_PARAM, readCatalogOrigin } from "@/lib/public/public-hrefs";
import { getLessonSessionContext } from "@/lib/session/lesson-session-context";
import {
  type PlayableLibraryLessonResult,
  getLibraryLessonOutline,
  getPlayableLibraryLesson,
} from "@zoonk/core/lesson-player/get";
import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/playable-lesson";
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

  return {
    firstAnswer: typeof firstAnswer === "string" ? firstAnswer : null,
    origin: readCatalogOrigin(query[ORIGIN_PARAM]),
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

async function loadWaitingState(result: PlayableLibraryLessonResult | null) {
  return result?.status === "notGenerated"
    ? getLessonWaitingState({ lessonId: result.lesson.id })
    : null;
}

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
 * A missing task's message is left to the browser here: drawing the task's frame on the server too
 * makes this page's scripts carry the frame's code twice, about 11 KB more on every visit.
 */
async function LessonPlayerContent({ params, searchParams }: Props) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const { firstAnswer, origin, studySessionId } = readPlayerQuery(query);

  const lessonRead = getPlayableLibraryLesson({ lessonId });
  const sessionRead = getSession();
  const sessionContextRead = getLessonSessionContext(studySessionId);

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

export default function LearnLessonPage(props: Props) {
  return (
    <Suspense fallback={<LessonPlayerSkeleton />}>
      <LessonPlayerContent {...props} />
    </Suspense>
  );
}
