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

/**
 * A chapter's map as one tap makes it: the tap asks for it (once at a time), then its status is
 * read again every few seconds while it's being made, and the page is read again once it's ready
 * or failed, so it shows without a reload. A map the page already shows ready stays ready.
 */
export function useMindMapRequest({
  actions,
  chapterId,
  status,
}: {
  actions: MindMapActions;
  chapterId: string;
  status: MindMapStatus;
}) {
  const [local, setLocal] = useState<{ limit?: MindMapLimit; shown: MindMapShown } | null>(null);
  const [isPending, startTransition] = useTransition();
  const shown: MindMapShown = status === "ready" ? "ready" : (local?.shown ?? status);

  const poll = usePoll({
    active: shown === "generating",
    intervalMs: POLL_MS,
    onPoll: async () => {
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
    limit: local?.limit ?? null,
    /** After a failure: checking on the map again when reading it failed, else asking again. */
    retry: isStuck ? poll.restart : create,
    shown: isStuck ? ("unreachable" as const) : shown,
  };
}
