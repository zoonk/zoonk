"use server";

import { redirect } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { type ChallengeDestination } from "@zoonk/core/checkpoints/challenge-contract";
import { moveChallenge, undoChallengeMove } from "@zoonk/core/checkpoints/challenge-move";
import { startChallenge } from "@zoonk/core/checkpoints/challenge-start";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import { MOVED_PARAM } from "./challenge-params";

const planItemIdSchema = z.uuid();
const changeIdSchema = z.uuid();
const sessionIdSchema = z.uuid();
const localeSchema = z.enum(SUPPORTED_LOCALES);

/** Where a move or its undo comes back to: the page's locale and the session that opened it. */
type ChallengePage = { locale: unknown; sessionId: unknown };

/**
 * "Start" on a challenge's day: today's block for it starts and the result says where it's played.
 * Inputs are untrusted, so they're parsed with the API's schemas.
 */
export async function startChallengeAction(
  planItemId: unknown,
  timeZone: unknown,
): Promise<ChallengeDestination | "dailyLimitReached" | null> {
  const id = planItemIdSchema.safeParse(planItemId);
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await startChallenge({ input: input.data, planItemId: id.data });

  if (result.status === "dailyLimitReached") {
    return "dailyLimitReached";
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
 * new day (a dated plan item is a new one once it moves) with the move's undo.
 */
export async function moveChallengeAction(
  { page, planItemId }: { page: ChallengePage; planItemId: unknown },
  timeZone: unknown,
): Promise<NotDone> {
  const id = planItemIdSchema.safeParse(planItemId);
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });
  const locale = localeSchema.safeParse(page.locale).data ?? DEFAULT_LOCALE;

  if (!id.success || !input.success) {
    return "notDone";
  }

  const result = await moveChallenge({ input: input.data, planItemId: id.data });

  if (result.status !== "moved") {
    return "notDone";
  }

  const { changeId, planItemId: movedId } = result.move;

  if (!movedId || !changeId) {
    return redirect({ href: "/today", locale });
  }

  const search = toSessionSearch(page.sessionId);
  const moved = `${MOVED_PARAM}=${changeId}`;

  return redirect({
    href: `/challenge/${movedId}${search ? `${search}&${moved}` : `?${moved}`}`,
    locale,
  });
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

  return redirect({
    href: result.planItemId
      ? `/challenge/${result.planItemId}${toSessionSearch(page.sessionId)}`
      : "/today",
    locale,
  });
}
