"use client";

import { type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { useState, useTransition } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { type MindMapActions } from "./mind-map-actions";

/** A map takes about half a minute; its status is read again this often meanwhile. */
const POLL_MS = 4000;

/** What a map shows: its status, or why a tap didn't start it. */
export type MindMapShown = MindMapStatus | "refused" | "unreachable";

/** A map on its way to the page still reads as being made; a wait that got stuck, as unreachable. */
function getShown({
  arriving,
  isStuck,
  shown,
}: {
  arriving: boolean;
  isStuck: boolean;
  shown: MindMapShown;
}): MindMapShown {
  if (isStuck) {
    return "unreachable";
  }

  return arriving ? "generating" : shown;
}

/**
 * A chapter's map as one tap makes it: the tap asks for it (once at a time), then its status is
 * read again every few seconds while it's being made, and the page is read again once it's ready
 * or failed, so it shows without a reload. A map the server has made but the page doesn't show yet
 * is still on its way: the page is read again every few seconds until it shows it (a read that
 * came back before the map, or failed, left Sofia's panel offering to make it again). A map the
 * page already shows ready stays ready. A cap of the learner's plan the page already knows is
 * reached (`cap`) is the limit before any tap.
 */
export function useMindMapRequest({
  actions,
  cap = null,
  chapterId,
  status,
}: {
  actions: MindMapActions;
  cap?: MindMapLimit | null;
  chapterId: string;
  status: MindMapStatus;
}) {
  const [local, setLocal] = useState<{ limit?: MindMapLimit; shown: MindMapShown } | null>(null);
  const [isPending, startTransition] = useTransition();
  const shown: MindMapShown = status === "ready" ? "ready" : (local?.shown ?? status);
  const arriving = shown === "ready" && status !== "ready";

  const poll = usePoll({
    active: shown === "generating" || arriving,
    intervalMs: POLL_MS,
    onPoll: async () => {
      if (arriving) {
        actions.refresh();
        return;
      }

      const next = await actions.readStatus(chapterId);

      if (next === null) {
        throw new Error("The map's status couldn't be read.");
      }

      if (next !== "generating") {
        setLocal({ shown: next });
        actions.refresh();
      }
    },
  });

  const create = () =>
    startTransition(async () => {
      const outcome = await actions.request(chapterId);

      if (outcome.status === "ready") {
        actions.refresh();
      }

      setLocal(
        outcome.status === "refused"
          ? { limit: outcome.limit, shown: "refused" }
          : { shown: outcome.status === "failed" ? "unreachable" : outcome.status },
      );
    });

  const isStuck = poll.status === "failed" || poll.status === "timedOut";

  return {
    create,
    isPending,
    limit: local?.limit ?? cap,
    /** After a failure: checking on the map again when reading it failed, else asking again. */
    retry: isStuck ? poll.restart : create,
    shown: getShown({ arriving, isStuck, shown }),
  };
}
