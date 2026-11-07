"use client";

import { type ChapterMindMapView, type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { useState, useTransition } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { type MindMapActions, type MindMapRequestOutcome } from "./mind-map-actions";

const DRAWING_POLL_MS = 4000;
const WRITING_POLL_MS = 15_000;
const WRITING_TIMEOUT_MS = 30 * 60 * 1000;

export type MindMapShown = MindMapStatus | "refused" | "unreachable";

type Local = { limit?: MindMapLimit; shown: MindMapShown };

function getServedKey(view: ChapterMindMapView): string {
  return `${view.status}:${view.image?.url ?? ""}`;
}

function getShownAfterRequest(outcome: Exclude<MindMapRequestOutcome, { status: "refused" }>) {
  if (outcome.status === "failed") {
    return "unreachable";
  }

  return outcome.status === "unavailable" ? "failed" : outcome.status;
}

/** Follows the map from the tap until it's ready, then reads it, so the row needs no page reload. */
export function useMindMapRequest({
  actions,
  view: served,
}: {
  actions: MindMapActions;
  view: ChapterMindMapView;
}) {
  const [view, setView] = useState(served);
  const [servedKey, setServedKey] = useState(() => getServedKey(served));
  const [local, setLocal] = useState<Local | null>(null);
  const [isPending, startTransition] = useTransition();

  if (getServedKey(served) !== servedKey) {
    setServedKey(getServedKey(served));
    setView(served);
    setLocal(null);
  }

  const shown = local?.shown ?? view.status;
  const { chapterId } = view;

  const showReady = async (): Promise<boolean> => {
    const next = await actions.read(chapterId).catch(() => null);

    if (!next) {
      return false;
    }

    setView(next);
    setLocal(null);
    return true;
  };

  const poll = usePoll({
    active: shown === "drawing" || shown === "writingLessons",
    intervalMs: shown === "writingLessons" ? WRITING_POLL_MS : DRAWING_POLL_MS,
    key: shown,
    onPoll: async () => {
      const next = await actions.readStatus(chapterId);

      if (next === null || (next === "ready" && !(await showReady()))) {
        throw new Error("The map couldn't be read.");
      }

      if (next !== "ready" && next !== shown) {
        setLocal({ shown: next });
      }
    },
    timeoutMs: shown === "writingLessons" ? WRITING_TIMEOUT_MS : undefined,
  });

  const create = () =>
    startTransition(async () => {
      const outcome = await actions
        .request(chapterId)
        .catch((): MindMapRequestOutcome => ({ status: "failed" }));

      if (outcome.status === "ready") {
        if (!(await showReady())) {
          setLocal({ shown: "unreachable" });
        }

        return;
      }

      setLocal(
        outcome.status === "refused"
          ? { limit: outcome.limit, shown: "refused" }
          : { shown: getShownAfterRequest(outcome) },
      );
    });

  const isStuck = poll.status === "failed" || poll.status === "timedOut";

  return {
    create,
    isPending,
    limit: local?.limit ?? null,
    retry: isStuck ? poll.restart : create,
    shown: isStuck ? "unreachable" : shown,
    view,
  };
}
