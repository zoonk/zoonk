import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { isCurrentSession } from "./_utils/current-session";
import { persistEntitlementLapseRefill } from "./_utils/entitlement-lapse-refill";
import { readLessonScreens } from "./_utils/lesson-screens";
import { loadStudySessionView } from "./_utils/load-session-view";
import { loadOpenedDayView } from "./_utils/open-day-view";
import { openSessionBlock, openingResult } from "./_utils/open-session-block";
import { followSavedDay } from "./_utils/refresh-study-day-selection";
import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";
import {
  STUDY_SESSION_INCLUDE,
  type StudySessionRow,
  findStudySessionFor,
} from "./_utils/study-session-access";
import { getSessionPageView } from "./get-session-page-view";
import { type OpenStudyBlockInput, type OpenStudyBlockResult } from "./open-block-contract";

type Target<Kind extends OpenStudyBlockInput["target"]["kind"]> = Extract<
  OpenStudyBlockInput["target"],
  { kind: Kind }
>;

type OpenedSession =
  | { session: StudySessionView; status: "ready"; userId: string }
  | { status: "goalNotActive" | "retryable" };

async function openSavedSession({
  session,
  timeZone: deviceTimeZone,
  userId,
}: {
  session: StudySessionRow;
  timeZone: string | undefined;
  userId: string;
}): Promise<OpenedSession> {
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: deviceTimeZone });

  if (!isCurrentSession({ now: new Date(), session, timeZone }) || !session.goal) {
    const view = await readLessonScreens(await loadStudySessionView({ session, timeZone, userId }));
    return { session: view, status: "ready", userId };
  }

  if (session.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const refilled = await persistEntitlementLapseRefill({ goal: session.goal, session, timeZone });

  if (!refilled) {
    return { status: "retryable" };
  }

  const current = await followSavedDay({ goal: session.goal, session: refilled, timeZone });

  const view = await readLessonScreens(
    await loadOpenedDayView({ session: current, timeZone, userId }),
  );

  return { session: view, status: "ready", userId };
}

/** Continue never begins a mock the learner didn't see. */
function isChangedMock({
  blocks,
  expectedBlockId,
  next,
}: {
  blocks: readonly StudyBlockView[];
  expectedBlockId: string | undefined;
  next: StudyBlockView | undefined;
}): boolean {
  if (!expectedBlockId || next?.id === expectedBlockId) {
    return false;
  }

  const shown = blocks.find((block) => block.id === expectedBlockId);
  return Boolean(next?.checkpoint?.mock || shown?.checkpoint?.mock);
}

async function openNext({
  target,
  timeZone,
  userId,
}: {
  target: Target<"next">;
  timeZone: string | undefined;
  userId: string;
}): Promise<OpenStudyBlockResult> {
  const owned = await findStudySessionFor({ sessionId: target.sessionId, userId });

  if (owned.status !== "ready") {
    return owned;
  }

  const opened = await openSavedSession({ session: owned.session, timeZone, userId });

  if (opened.status !== "ready") {
    return opened;
  }

  const { session } = opened;

  if (!session.current) {
    return openingResult({ kind: "today" });
  }

  const next = session.blocks.find((block) => block.id === session.nextBlockId);

  if (isChangedMock({ blocks: session.blocks, expectedBlockId: target.expectedBlockId, next })) {
    return openingResult({ kind: "changed" });
  }

  return next
    ? openSessionBlock({ block: next, sessionId: session.id, timeZone, userId })
    : openingResult({ blockId: null, kind: "session" });
}

async function openTappedBlock({
  target,
  timeZone,
  userId,
}: {
  target: Target<"block">;
  timeZone: string | undefined;
  userId: string;
}): Promise<OpenStudyBlockResult> {
  const saved = await prisma.studySession.findFirst({
    include: STUDY_SESSION_INCLUDE,
    where: { blocks: { some: { id: target.blockId } }, userId },
  });

  if (!saved) {
    return { status: "notFound" };
  }

  const opened = await openSavedSession({ session: saved, timeZone, userId });

  if (opened.status !== "ready") {
    return opened;
  }

  const block = opened.session.blocks.find((candidate) => candidate.id === target.blockId);

  return block
    ? openSessionBlock({ block, sessionId: opened.session.id, timeZone, userId })
    : { status: "notFound" };
}

/** A mission opens only a block still free to start; anything else reads the host again. */
async function openMission({
  target,
  timeZone,
}: {
  target: Target<"mission">;
  timeZone: string | undefined;
}): Promise<OpenStudyBlockResult> {
  const day = await getSessionPageView({ blockId: target.blockId });

  if (day.status === "notFound" || day.status === "unauthorized") {
    return { status: day.status };
  }

  const block =
    day.status === "ready"
      ? day.session.blocks.find(
          (candidate) =>
            candidate.id === target.blockId &&
            (candidate.status === "pending" || candidate.status === "active") &&
            candidate.waitReason === null,
        )
      : undefined;

  if (day.status !== "ready" || !block) {
    return openingResult({ kind: "changed" });
  }

  const opened = await openSessionBlock({
    block,
    sessionId: day.session.id,
    timeZone,
    userId: day.userId,
  });

  return opened.status === "ready" &&
    opened.opening.kind === "session" &&
    opened.opening.blockId === null
    ? openingResult({ kind: "changed" })
    : opened;
}

/**
 * Opens a study block the learner chose (Continue, a tap, a mission) and says which screen shows it.
 * Starting it, when the screen doesn't start it itself, prepares the session's next lessons.
 */
export async function openStudyBlock({
  target,
  timeZone,
}: OpenStudyBlockInput): Promise<OpenStudyBlockResult> {
  if (target.kind === "mission") {
    return openMission({ target, timeZone });
  }

  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  const userId = actor.user.id;

  return target.kind === "next"
    ? openNext({ target, timeZone, userId })
    : openTappedBlock({ target, timeZone, userId });
}
