import "server-only";
import { prisma } from "@zoonk/db";
import {
  arePhaseChallengesRequired,
  withoutLockedPhaseChallenges,
} from "../checkpoints/_utils/phase-challenge-access";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { isCurrentSession } from "./_utils/current-session";
import { persistEntitlementLapseRefill } from "./_utils/entitlement-lapse-refill";
import { readLessonScreens } from "./_utils/lesson-screens";
import { openSessionBlock, openingResult } from "./_utils/open-session-block";
import { followSavedDay } from "./_utils/refresh-study-day-selection";
import { type StudyBlockView, getNextBlockId, toStudyBlockView } from "./_utils/session-view";
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
  | {
      session: {
        id: string;
        current: boolean;
        blocks: StudyBlockView[];
        nextBlockId: string | null;
      };
      status: "ready";
      userId: string;
    }
  | { status: "goalNotActive" | "retryable" };

async function openSavedSession({
  session,
  targetBlockId,
  timeZone: deviceTimeZone,
  userId,
}: {
  session: StudySessionRow;
  targetBlockId?: string;
  timeZone: string | undefined;
  userId: string;
}): Promise<OpenedSession> {
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: deviceTimeZone });
  const current = isCurrentSession({ now: new Date(), session, timeZone });

  if (current && session.goal && session.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const refilled =
    current && session.goal
      ? await persistEntitlementLapseRefill({ goal: session.goal, session, timeZone })
      : session;

  if (!refilled) {
    return { status: "retryable" };
  }

  const required =
    !session.goal || (await arePhaseChallengesRequired({ goalKind: session.goal.kind, userId }));

  const visible = withoutLockedPhaseChallenges({
    blocks: refilled.blocks,
    phaseChallengesRequired: required,
  });

  const targetId = targetBlockId ?? getNextBlockId(visible);
  const target = visible.find((block) => block.id === targetId);

  // Queue reconciliation only appends work, so existing work does not wait for it. Entitlement replacement still runs before target selection.
  const selected =
    current &&
    refilled.goal &&
    (!target || (target.status !== "pending" && target.status !== "active"))
      ? await followSavedDay({ session: refilled, timeZone })
      : refilled;

  const blocks = withoutLockedPhaseChallenges({
    blocks: selected.blocks,
    phaseChallengesRequired: required,
  });

  const view = await readLessonScreens({
    blocks: blocks.map((block) => toStudyBlockView({ answeredItemIds: new Set(), block, blocks })),
    current,
    id: selected.id,
    nextBlockId: getNextBlockId(blocks),
  });

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
    : openingResult({ blockId: null, kind: "session", sessionId: session.id });
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

  const opened = await openSavedSession({
    session: saved,
    targetBlockId: target.blockId,
    timeZone,
    userId,
  });

  if (opened.status !== "ready") {
    return opened;
  }

  const block = opened.session.blocks.find((candidate) => candidate.id === target.blockId);

  return block
    ? openSessionBlock({ block, sessionId: opened.session.id, timeZone, userId })
    : { status: "notFound" };
}

/**
 * A mission opens only a block of today still free to start; anything else, a block a plan change
 * removed included (before or while it opens), reads the host again.
 */
async function openMission({
  target,
  timeZone,
}: {
  target: Target<"mission">;
  timeZone: string | undefined;
}): Promise<OpenStudyBlockResult> {
  const day = await getSessionPageView({ blockId: target.blockId, timeZone });

  if (day.status === "unauthorized") {
    return { status: day.status };
  }

  const block =
    day.status === "ready" && day.session.current
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

  const finished =
    opened.status === "ready" &&
    opened.opening.kind === "session" &&
    opened.opening.blockId === null;

  return finished || opened.status === "notFound" ? openingResult({ kind: "changed" }) : opened;
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
