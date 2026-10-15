import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { redirect } from "@/i18n/navigation";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { readLessonWritingRequest } from "@/lib/lessons/lesson-writing-href";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { LESSON_LIMIT_PARAM, readLessonLimitParam } from "@/lib/session/lesson-limit-param";
import { SESSION_BLOCK_PARAM, readSessionBlockParam } from "@/lib/session/session-block-param";
import { SESSION_GOAL_PARAM, readSessionGoalParam } from "@/lib/session/session-goal-param";
import {
  SESSION_PREPARING_PARAM,
  readSessionPreparingParam,
} from "@/lib/session/session-preparing-param";
import {
  SESSION_STOPPED_PARAM,
  readSessionStoppedParam,
} from "@/lib/session/session-stopped-param";
import { withQuery } from "@/lib/with-query";
import { findAlternativeStudyBlock } from "@zoonk/core/sessions/alternative";
import { getStudyBlock } from "@zoonk/core/sessions/block";
import { getDayBlockScreen } from "@zoonk/core/sessions/day-block";
import {
  type NextStopFacts,
  type SessionPageView,
  getSessionPageView,
} from "@zoonk/core/sessions/page";
import { getStudySessionSummary } from "@zoonk/core/sessions/summary";
import { getSession } from "@zoonk/core/users/session";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { type DayStep, type StudyBlock, type StudySession } from "@zoonk/learn/session/types";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import {
  getNextStopLesson,
  getNotWritten,
  getWritingRunId,
  loadLessonState,
} from "./next-step-lesson";
import { SessionBlockClient, SessionNextStopClient, SessionSummaryClient } from "./session-client";
import { SessionEntryFallback } from "./session-entry-fallback";

type Props = PageProps<"/[lang]/session">;

type SessionFacts = Pick<SessionPageView, "goal" | "localDate" | "userId">;

/** One learner's own day: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Today's session") };
}

/** Questions play here; lessons open in the player, checkpoints and essays on their own screen. */
function isQuestionBlock(block: DayStep): boolean {
  return block.kind !== "learn" && getDayBlockScreen(block, { lessonReady: null }) === "session";
}

/**
 * The session's full screen, around the screens that don't bring their own `main`: the summary and
 * a missing block's answer (both task screens), and the sign-in gate, do.
 */
function SessionMain({ children }: { children: React.ReactNode }) {
  return <main className="bg-background flex min-h-dvh flex-col">{children}</main>;
}

/** The answer for a session or block that isn't there: the task's own not-found screen, as a 404. */
function SessionNotFound() {
  return (
    <NotFoundPage>
      <TaskNotFound />
    </NotFoundPage>
  );
}

async function SessionSummaryView({
  facts,
  session,
  stopped,
}: {
  facts: SessionFacts;
  session: StudySession;
  stopped: boolean;
}) {
  const [result, viewer, buddy] = await Promise.all([
    getStudySessionSummary({ input: {}, sessionId: session.id }),
    getSession(),
    getLearnerBuddy(),
  ]);

  if (result.status !== "ready") {
    return (
      <>
        <LearnerWitness />
        <SessionNotFound />
      </>
    );
  }

  // The summary is a task screen of its own, with its own `main`.
  return (
    <>
      <LearnerWitness />

      <SessionSummaryClient
        goalKind={facts.goal.kind}
        isGuest={Boolean(viewer?.user.isAnonymous)}
        buddy={buddy}
        sessionId={session.id}
        stopped={stopped}
        summary={result.summary}
      />
    </>
  );
}

/**
 * The block the learner opened (`?block=`), while it's still to do: Today's queue opens any of the
 * day's blocks, so the first one under way isn't always the one they picked.
 */
function findOpenedBlock({ blockId, session }: { blockId: string | null; session: StudySession }) {
  return (
    session.blocks.find(
      (block) => block.id === blockId && (block.status === "active" || block.status === "pending"),
    ) ?? null
  );
}

/** The question block the screen plays: the one the learner opened, or else the first under way. */
function findActiveQuestionBlock({
  opened,
  session,
}: {
  opened: StudyBlock | null;
  session: StudySession;
}) {
  if (opened) {
    return opened.status === "active" && isQuestionBlock(opened) ? opened : null;
  }

  return session.blocks.find((block) => block.status === "active" && isQuestionBlock(block));
}

type ScreenRequest = { limit: LessonLimit | null; request: LessonRequest };

/** A screen whose address asks nothing about the step's lesson. */
const UNASKED: ScreenRequest = { limit: null, request: { status: "idle" } };

/**
 * What the learner's tap asked about a step's lesson, as the address carries it: the run writing
 * it, why it can't be written now, or that it's being prepared (`?preparing`: asked, no run yet).
 */
function readScreenRequest(search: Awaited<Props["searchParams"]>): ScreenRequest {
  const request = readLessonWritingRequest(search);
  const preparing = readSessionPreparingParam(search[SESSION_PREPARING_PARAM]);

  return {
    limit: readLessonLimitParam(search[LESSON_LIMIT_PARAM]),
    request: request.status === "idle" && preparing ? { status: "requesting" } : request,
  };
}

/**
 * The next step of either kind of day, for the session screen: its lesson's state and why it won't
 * be written now, the day's facts the screen keys and guards it by, and a ready block to do while
 * it's written (a saved day only: a day not opened yet has no block to start in its place).
 */
async function NextStepView({
  alternative,
  day,
  facts,
  next,
  screen,
  step,
}: {
  alternative: StudyBlock | null;
  day: Parameters<typeof SessionNextStopClient>[0]["day"];
  facts: SessionFacts;
  next: NextStopFacts | null;
  screen: ScreenRequest;
  step: DayStep;
}) {
  const state = await loadLessonState({ next, step });
  const lesson = getNextStopLesson({ ...screen, state, step });

  return (
    <SessionMain>
      <SessionNextStopClient
        alternative={lesson === "ready" ? null : alternative}
        asked={screen.request.status !== "idle"}
        day={day}
        generationId={getWritingRunId({ request: screen.request, state })}
        goalId={facts.goal.id}
        key={`${facts.goal.id}:${facts.localDate.toISOString()}:${step.position}`}
        lesson={lesson}
        notWritten={getNotWritten({ lesson, state, ...screen })}
        step={step}
        stepRef={next?.ref.position === step.position ? next.ref : null}
        userId={facts.userId}
      />
    </SessionMain>
  );
}

async function SavedDayView({
  blockId,
  facts,
  next,
  screen,
  session,
  stopped,
}: {
  blockId: string | null;
  facts: SessionFacts;
  next: NextStopFacts | null;
  screen: ScreenRequest;
  session: StudySession;
  /** The learner just stopped for today: what changed so far, before the next step. */
  stopped: boolean;
}) {
  if (stopped) {
    return <SessionSummaryView facts={facts} session={session} stopped />;
  }

  const opened = findOpenedBlock({ blockId, session });
  const active = findActiveQuestionBlock({ opened, session });

  if (active) {
    const [detail, tutor] = await Promise.all([
      getStudyBlock({ blockId: active.id, sessionId: session.id }),
      getTutorViewer(),
    ]);

    if (detail.status !== "ready") {
      return (
        <>
          <LearnerWitness />
          <SessionNotFound />
        </>
      );
    }

    // Asking the buddy about a question opens the player's conversation.
    return (
      <SessionMain>
        <LearnerWitness />
        <ClientMessagesProvider scope="player">
          <SessionBlockClient detail={detail.detail} session={session} tutor={tutor} />
        </ClientMessagesProvider>
      </SessionMain>
    );
  }

  const step = opened ?? session.blocks.find((block) => block.id === session.nextBlockId);

  if (!step) {
    return <SessionSummaryView facts={facts} session={session} stopped={false} />;
  }

  // The address's request is about the block it names: once that block is behind the learner,
  // the step shown now was never asked for.
  return (
    <>
      <LearnerWitness />

      <NextStepView
        alternative={findAlternativeStudyBlock({ blockId: step.id, blocks: session.blocks })}
        day={session}
        facts={facts}
        next={next}
        screen={step.id === blockId ? screen : UNASKED}
        step={step}
      />
    </>
  );
}

async function SessionContent({ searchParams }: Pick<Props, "searchParams">) {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [language, search] = await Promise.all([lang(), searchParams]);
  const blockId = readSessionBlockParam(search[SESSION_BLOCK_PARAM]);
  const goalId = blockId ? null : readSessionGoalParam(search[SESSION_GOAL_PARAM]);

  // The block names its day; else the goal whose day a tap opened; else the active goal's.
  const result = await getSessionPageView({
    ...(blockId ? { blockId } : {}),
    ...(goalId ? { goalId } : {}),
  });

  if (result.status === "unauthorized") {
    return (
      <>
        <LearnerWitness />
        <AuthGateScreen next={withQuery("/session", search)} />
      </>
    );
  }

  if (result.status === "noGoal") {
    redirect({ href: "/start", locale: language });
  }

  // A goal on pause, one not the learner's, or a plan still being built has no session to run:
  // Today explains it.
  if (result.status !== "ready" && result.status !== "unstarted") {
    redirect({ href: "/today", locale: language });
    return null;
  }

  if (result.status === "ready") {
    return (
      <SavedDayView
        blockId={blockId}
        facts={result}
        next={result.next}
        screen={readScreenRequest(search)}
        session={result.session}
        stopped={readSessionStoppedParam(search[SESSION_STOPPED_PARAM])}
      />
    );
  }

  const step = result.day.blocks.find((block) => block.position === result.day.nextPosition);

  // A day with nothing to open: Today says what the day is.
  if (!step) {
    redirect({ href: "/today", locale: language });
    return null;
  }

  // A day not opened yet has no block a tap's request could name.
  return (
    <>
      <LearnerWitness />

      <NextStepView
        alternative={null}
        day={result.day}
        facts={result}
        next={result.next}
        screen={UNASKED}
        step={step}
      />
    </>
  );
}

/**
 * Today's session, full screen like a lesson: the question block in progress, the next step, or
 * the summary once the day's blocks are done (or what changed so far, right after stopping). Its
 * frame is static: a tap from a screen that showed the day draws the tapped step at once from what
 * that screen held (`SessionEntryFallback`), and a hard load draws the frame until the day streams
 * into the same response. Never a placeholder.
 */
export default function SessionPage({ searchParams }: Props) {
  return (
    <MainLearnProvider>
      <Suspense
        fallback={
          <SessionMain>
            <SessionEntryFallback />
          </SessionMain>
        }
      >
        <SessionContent searchParams={searchParams} />
      </Suspense>
    </MainLearnProvider>
  );
}
