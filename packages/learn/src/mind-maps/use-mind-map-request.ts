"use client";

import { type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { useState, useTransition } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { type MindMapActions } from "./mind-map-actions";

const POLL_MS = 4000;

export type MindMapShown = MindMapStatus | "refused" | "unreachable";

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
    retry: isStuck ? poll.restart : create,
    shown: getShown({ arriving, isStuck, shown }),
  };
}
