"use client";

import { type ChapterMindMapView, type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { useState, useTransition } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { type MindMapActions, type MindMapRequestOutcome } from "./mind-map-actions";

const DRAWING_POLL_MS = 4000;
const WRITING_POLL_MS = 15_000;

export type MindMapShown = MindMapStatus | "refused" | "unreachable";

/** What only this device knows: the server keeps no refusal, and can't say it wasn't reached. */
type Local = { limit?: MindMapLimit; shown: "refused" | "unreachable" };

/**
 * Follows the map from the tap until it's ready, then reads it. The caller owns `view`, so what it
 * derives from its maps (a count, a notice) changes with the row.
 */
export function useMindMapRequest({
  actions,
  onViewChange,
  view,
}: {
  actions: MindMapActions;
  onViewChange: (view: ChapterMindMapView) => void;
  view: ChapterMindMapView;
}) {
  const [local, setLocal] = useState<Local | null>(null);
  const [localView, setLocalView] = useState(view);
  const [isPending, startTransition] = useTransition();
  const { chapterId, status } = view;

  if (localView !== view) {
    setLocalView(view);
    setLocal(null);
  }

  const showStatus = (next: MindMapStatus) => {
    if (next !== status) {
      onViewChange({ ...view, status: next });
    }
  };

  const showReady = async (): Promise<boolean> => {
    const next = await actions.read(chapterId).catch(() => null);

    if (next) {
      onViewChange(next);
    }

    return next !== null;
  };

  const poll = usePoll({
    active: local === null && (status === "drawing" || status === "writingLessons"),
    intervalMs: status === "writingLessons" ? WRITING_POLL_MS : DRAWING_POLL_MS,
    key: status,
    onPoll: async () => {
      const next = await actions.readStatus(chapterId);

      if (next === null || (next === "ready" && !(await showReady()))) {
        throw new Error("The map couldn't be read.");
      }

      if (next !== "ready") {
        showStatus(next);
      }
    },
    // The server turns a run that stops reporting into `failed`; writing lessons can outlast any limit here.
    timeoutMs: Number.POSITIVE_INFINITY,
  });

  const settle = async (outcome: MindMapRequestOutcome) => {
    if (outcome.status === "refused") {
      setLocal({ limit: outcome.limit, shown: "refused" });
      return;
    }

    if (outcome.status === "failed" || (outcome.status === "ready" && !(await showReady()))) {
      setLocal({ shown: "unreachable" });
      return;
    }

    if (outcome.status !== "ready") {
      setLocal(null);
      showStatus(outcome.status === "unavailable" ? "failed" : outcome.status);
    }
  };

  const create = () =>
    startTransition(async () => {
      const outcome = await actions
        .request(chapterId)
        .catch((): MindMapRequestOutcome => ({ status: "failed" }));

      await settle(outcome);
    });

  const isStuck = poll.status === "failed";

  return {
    create,
    isPending,
    limit: local?.limit ?? null,
    retry: isStuck ? poll.restart : create,
    shown: isStuck ? "unreachable" : (local?.shown ?? status),
  };
}
