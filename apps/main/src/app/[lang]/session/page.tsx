import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { LESSON_LIMIT_PARAM, readLessonLimitParam } from "@/lib/session/lesson-limit-param";
import { getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getStudyBlock } from "@zoonk/core/sessions/block";
import { getStudySessionSummary } from "@zoonk/core/sessions/summary";
import { getSession } from "@zoonk/core/users/session";
import { type TodayView, getTodayView } from "@zoonk/core/view-models/today/get";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { type LessonNotWritten } from "@zoonk/learn/lesson-not-written";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { type StudyBlock, type StudySession } from "@zoonk/learn/session/types";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { SessionBlockClient, SessionNextStopClient, SessionSummaryClient } from "./session-client";

type Props = PageProps<"/[lang]/session">;

/** One learner's own day: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Today's session") };
}

/** Lessons open in the player, checkpoints and essays on their own screen; the rest plays here. */
function isQuestionBlock(block: StudyBlock): boolean {
  return block.kind !== "learn" && block.kind !== "checkpoint" && block.kind !== "produce";
}

/** Where the next block's lesson stands; blocks without a lesson are always ready to start. */
function getNextStopLesson({
  lessonStatus,
  next,
}: {
  lessonStatus: TodayView["lessonStatus"];
  next: StudyBlock;
}): NextStopLesson {
  if (next.kind !== "learn") {
    return "ready";
  }

  const status = next.lessonId ? lessonStatus[next.lessonId] : undefined;

  if (status === "ready") {
    return "ready";
  }

  if (status === "generating") {
    return "writing";
  }

  return status === "failed" ? "failed" : "notStarted";
}

/**
 * The run writing the next block's lesson, so the wait follows its progress: the same readiness
 * a native client reads (`/v1/library/lessons/{lessonId}/readiness`), only while it's written.
 */
async function getWritingRunId({
  lesson,
  next,
}: {
  lesson: NextStopLesson;
  next: StudyBlock;
}): Promise<string | null> {
  if (lesson !== "writing" || !next.lessonId) {
    return null;
  }

  const waiting = await getLessonWaitingState({ lessonId: next.lessonId });
  return waiting.status === "ready" ? waiting.state.generationId : null;
}

/**
 * Why the next block's lesson won't be written now: every draft failed its checks (read from the
 * lesson), or the learner's request was just turned down (`?limit=`, from the tap that asked).
 * Only a lesson nothing writes can be refused, so a stale `?limit=` never hides a wait.
 */
async function getNotWritten({
  lesson,
  limit,
  next,
}: {
  lesson: NextStopLesson;
  limit: LessonLimit | null;
  next: StudyBlock;
}): Promise<LessonNotWritten | null> {
  if (lesson === "failed" && next.lessonId) {
    const state = await getLessonGenerationState(next.lessonId);
    return state?.status === "failed" && state.setAside ? { status: "setAside" } : null;
  }

  return lesson === "notStarted" && limit ? { limit, status: "refused" } : null;
}

/** A ready block to do while a lesson is written: anything but another lesson. */
function findAlternative({ next, session }: { next: StudyBlock; session: StudySession }) {
  return (
    session.blocks.find(
      (block) => block.id !== next.id && block.status === "pending" && block.kind !== "learn",
    ) ?? null
  );
}

async function SessionSummaryView({
  buddy,
  session,
}: {
  buddy: LearnBuddy | null;
  session: StudySession;
}) {
  const [result, belt, viewer] = await Promise.all([
    getStudySessionSummary({ input: {}, sessionId: session.id }),
    getBeltLevel(),
    getSession(),
  ]);

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <SessionSummaryClient
      brainPower={belt?.totalBrainPower ?? null}
      isGuest={Boolean(viewer?.user.isAnonymous)}
      buddy={buddy}
      sessionId={session.id}
      summary={result.summary}
    />
  );
}

async function SessionView({
  buddy,
  limit,
  today,
}: {
  buddy: LearnBuddy | null;
  limit: LessonLimit | null;
  today: TodayView;
}) {
  const { lessonStatus, session } = today;

  const active = session.blocks.find(
    (block) => block.status === "active" && isQuestionBlock(block),
  );

  if (active) {
    const detail = await getStudyBlock({ blockId: active.id, sessionId: session.id });

    if (detail.status !== "ready") {
      notFound();
    }

    return <SessionBlockClient detail={detail.detail} session={session} />;
  }

  const next = session.blocks.find((block) => block.id === session.nextBlockId);

  if (!next) {
    return <SessionSummaryView buddy={buddy} session={session} />;
  }

  const lesson = getNextStopLesson({ lessonStatus, next });

  const [generationId, notWritten] = await Promise.all([
    getWritingRunId({ lesson, next }),
    getNotWritten({ lesson, limit, next }),
  ]);

  return (
    <SessionNextStopClient
      alternative={lesson === "ready" ? null : findAlternative({ next, session })}
      block={next}
      generationId={generationId}
      key={next.id}
      lesson={lesson}
      notWritten={notWritten}
      session={session}
    />
  );
}

async function SessionContent({ searchParams }: Pick<Props, "searchParams">) {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [language, result, buddy, mode, search] = await Promise.all([
    lang(),
    getTodayView({}),
    getLearnerBuddy(),
    getExperienceMode(),
    searchParams,
  ]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: language });
  }

  if (result.status === "noGoal") {
    redirect({ href: "/start", locale: language });
  }

  // A goal on pause or a plan still being built has no session to run: Today explains it.
  if (result.status !== "ready") {
    redirect({ href: "/today", locale: language });
    return null;
  }

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <main className="bg-background in-data-[mode=fun]:fun-space flex min-h-dvh flex-col">
          <div className="mx-auto flex w-full max-w-150 flex-1 flex-col px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SessionView
              buddy={buddy}
              limit={readLessonLimitParam(search[LESSON_LIMIT_PARAM])}
              today={result.today}
            />
          </div>
        </main>
      </MainLearnProvider>
    </ModeProvider>
  );
}

function SessionSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-150 flex-col gap-6 px-4 py-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="mt-auto h-12 w-full rounded-full" />
      </main>
    </DeviceModeRoot>
  );
}

/**
 * Today's session, full screen like a lesson: the question block in progress, the next stop, or
 * the end-of-session summary once the day's blocks are done or stopped.
 */
export default function SessionPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionContent searchParams={searchParams} />
    </Suspense>
  );
}
