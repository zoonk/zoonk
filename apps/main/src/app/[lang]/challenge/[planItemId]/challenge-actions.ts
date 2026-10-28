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

type ChallengePage = { locale: unknown; sessionId: unknown };

/** Start may save today's session before it refuses, so no outcome means nothing was saved. */
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

function toSessionSearch(sessionId: unknown): string {
  const id = sessionIdSchema.safeParse(sessionId);
  return id.success ? `?${STUDY_SESSION_PARAM}=${id.data}` : "";
}

type NotDone = "notDone";

export async function moveChallengeAction(
  { page, planItemId }: { page: ChallengePage; planItemId: unknown },
  timeZone: unknown,
): Promise<
  | NotDone
  | { moveBeforeNextMonday: true }
  | { mockCollision: true }
  | { noRoom: true }
  | { unfundedMove: UnfundedMove }
> {
  const id = planItemIdSchema.safeParse(planItemId);
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });
  const locale = localeSchema.safeParse(page.locale).data ?? DEFAULT_LOCALE;

  if (!id.success || !input.success) {
    return "notDone";
  }

  const result = await moveChallenge({ input: input.data, planItemId: id.data });

  if (result.status === "invalid" && result.error === "moveBeforeNextMonday") {
    return { moveBeforeNextMonday: true };
  }

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

  // The moved item is gone too, so the page back on its day replaces it.
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
