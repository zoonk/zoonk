"use server";

import { redirect } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { type ChallengeDestination } from "@zoonk/core/checkpoints/challenge-contract";
import { moveChallenge, undoChallengeMove } from "@zoonk/core/checkpoints/challenge-move";
import { type StartChallengeResult, startChallenge } from "@zoonk/core/checkpoints/challenge-start";
import { type UnfundedMove } from "@zoonk/core/plans/plan-error-contract";
import {
  studyBlockStartInputSchema,
  studySessionTimeZoneInputSchema,
} from "@zoonk/core/sessions/contract";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { RedirectType } from "next/navigation";
import { z } from "zod";
import { MOVED_PARAM } from "./challenge-params";

const planItemIdSchema = z.uuid();
const changeIdSchema = z.uuid();
const sessionIdSchema = z.uuid();
const localeSchema = z.enum(SUPPORTED_LOCALES);

/** Where a move or its undo comes back to: the page's locale and the session that opened it. */
type ChallengePage = { locale: unknown; sessionId: unknown };

/**
 * "Start" on a challenge's day: today's block for it starts and the result says where it's played,
 * or that the bank holds too few questions for it yet (`questionsNeeded`: they're written first,
 * and once the learner waited for that, `afterWriting` starts it with what was written), or that
 * the learner's plan leaves it to Plus (`plusRequired`, as when Plus lapsed since the intro opened).
 * `notToday` (today's session was planned without it), `dailyLimitReached` (today's study time ran
 * out since the intro opened) and `earlierFirst` (with its `reason`: the day's lessons or the
 * challenge before it come first) are named outcomes the intro reads again for. Each can follow a
 * write, since Start may save today's session before it refuses, so none says nothing was saved.
 * Inputs are untrusted, so they're parsed with the API's schemas.
 */
export async function startChallengeAction(
  planItemId: unknown,
  timeZone: unknown,
  afterWriting: unknown = false,
): Promise<
  | ChallengeDestination
  | Extract<StartChallengeResult, { status: "earlierFirst" }>
  | "blockFinished"
  | "dailyLimitReached"
  | "notToday"
  | "plusRequired"
  | "questionsNeeded"
  | null
> {
  const id = planItemIdSchema.safeParse(planItemId);
  const input = studyBlockStartInputSchema.safeParse({ afterWriting, timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await startChallenge({ input: input.data, planItemId: id.data });

  if (
    result.status === "blockFinished" ||
    result.status === "dailyLimitReached" ||
    result.status === "notToday" ||
    result.status === "plusRequired" ||
    result.status === "questionsNeeded"
  ) {
    return result.status;
  }

  if (result.status === "earlierFirst") {
    return result;
  }

  return result.status === "ready" ? result.destination : null;
}

/** `?session=` for a challenge today's session opened, so its block continues back to it. */
function toSessionSearch(sessionId: unknown): string {
  const id = sessionIdSchema.safeParse(sessionId);
  return id.success ? `?${STUDY_SESSION_PARAM}=${id.data}` : "";
}

/** What a move or its undo answers when it didn't go through; otherwise it redirects. */
type NotDone = "notDone";

/**
 * "Move to Monday": the week's challenge moves through the plan, and the page goes on to it on its
 * new day (a dated plan item is a new one once it moves) with the move's undo. A mock the plan
 * can't make room for that Monday stays where it is, and the answer says when and how long, for
 * the screen to say why (`unfundedMove`); one onto a day that already has a mock says that
 * (`mockCollision`); a weekly challenge the plan can't put there says so too (`noRoom`), since
 * asking again can only be refused again.
 */
export async function moveChallengeAction(
  { page, planItemId }: { page: ChallengePage; planItemId: unknown },
  timeZone: unknown,
): Promise<NotDone | { mockCollision: true } | { noRoom: true } | { unfundedMove: UnfundedMove }> {
  const id = planItemIdSchema.safeParse(planItemId);
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });
  const locale = localeSchema.safeParse(page.locale).data ?? DEFAULT_LOCALE;

  if (!id.success || !input.success) {
    return "notDone";
  }

  const result = await moveChallenge({ input: input.data, planItemId: id.data });

  if (result.status === "invalid" && result.unfundedMove) {
    return { unfundedMove: result.unfundedMove };
  }

  if (result.status === "invalid" && result.error === "mockCollision") {
    return { mockCollision: true };
  }

  if (result.status === "invalid" && result.error === "badMove") {
    return { noRoom: true };
  }

  if (result.status !== "moved") {
    return "notDone";
  }

  const { changeId, planItemId: movedId } = result.move;

  if (!movedId || !changeId) {
    // Keep the learner on the action's screen with its failure notice rather than silently leave.
    return "notDone";
  }

  const search = toSessionSearch(page.sessionId);
  const moved = `${MOVED_PARAM}=${changeId}`;

  // It replaces the page it leaves, whose item is gone once moved, so Back never opens it.
  return redirect(
    { href: `/challenge/${movedId}${search ? `${search}&${moved}` : `?${moved}`}`, locale },
    RedirectType.replace,
  );
}

/** Undoes the move while the plan is as it left it; the page goes back to it on its day. */
export async function undoChallengeMoveAction(
  { changeId, page, planItemId }: { changeId: unknown; page: ChallengePage; planItemId: unknown },
  timeZone: unknown,
): Promise<NotDone> {
  const id = planItemIdSchema.safeParse(planItemId);
  const change = changeIdSchema.safeParse(changeId);
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });
  const locale = localeSchema.safeParse(page.locale).data ?? DEFAULT_LOCALE;

  if (!id.success || !change.success || !input.success) {
    return "notDone";
  }

  const result = await undoChallengeMove({
    changeId: change.data,
    input: input.data,
    planItemId: id.data,
  });

  if (result.status !== "undone") {
    return "notDone";
  }

  // The moved item is gone too: the page back on its day replaces it, so Back leaves the challenge.
  return redirect(
    {
      href: result.planItemId
        ? `/challenge/${result.planItemId}${toSessionSearch(page.sessionId)}`
        : "/today",
      locale,
    },
    RedirectType.replace,
  );
}
