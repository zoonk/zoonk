"use client";

import { useRouter } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { type ChallengeActions, ChallengeScreen } from "@zoonk/learn/challenge";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import {
  moveChallengeAction,
  startChallengeAction,
  undoChallengeMoveAction,
} from "./challenge-actions";

/** Where a challenge's block is played: the checkpoint or the mock exam screen. */
function getBlockHref({
  blockId,
  mock,
  search,
}: {
  blockId: string;
  mock: boolean;
  search: string;
}): `/checkpoint/${string}` | `/mock/${string}` {
  return mock ? `/mock/${blockId}${search}` : `/checkpoint/${blockId}${search}`;
}

/**
 * Wires the challenge's intro to its actions in the learner's timezone. Starting opens its block,
 * which continues to the session when the session opened the intro (`sessionId`), or to Today. A
 * move or its undo goes on to the challenge on its day, since a dated plan item is a new one once
 * it moves.
 */
export function ChallengeClient({
  challenge,
  movedBy,
  sessionId,
}: {
  challenge: ChallengeView;
  movedBy: string | null;
  sessionId: string | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const { planItemId } = challenge;
  const search = sessionId ? `?${STUDY_SESSION_PARAM}=${sessionId}` : "";
  const page = useMemo(() => ({ locale, sessionId }), [locale, sessionId]);

  const actions = useMemo<ChallengeActions>(
    () => ({
      // A move that went through goes on to the challenge's new day (the action redirects).
      move: async () =>
        (await moveChallengeAction({ page, planItemId }, getLocalTimeZone())) !== "notDone",
      start: async () => {
        const started = await startChallengeAction(planItemId, getLocalTimeZone());

        if (!started || started === "dailyLimitReached") {
          return started ?? "failed";
        }

        router.push(
          getBlockHref({ blockId: started.blockId, mock: started.kind === "mock", search }),
        );

        return "started";
      },
      undoMove: async (changeId) =>
        (await undoChallengeMoveAction({ changeId, page, planItemId }, getLocalTimeZone())) !==
        "notDone",
    }),
    [page, planItemId, router, search],
  );

  const hrefs = useMemo(
    () => ({
      exit: "/today",
      open: challenge.blockId
        ? getBlockHref({ blockId: challenge.blockId, mock: challenge.mock, search })
        : null,
    }),
    [challenge.blockId, challenge.mock, search],
  );

  return (
    <ChallengeScreen actions={actions} challenge={challenge} hrefs={hrefs} movedBy={movedBy} />
  );
}
