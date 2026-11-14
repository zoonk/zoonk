"use client";

import { type ChapterMindMapView, type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { useState, useTransition } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { useReadOrder } from "../_utils/use-read-order";
import { type MindMapActions, type MindMapRequestOutcome } from "./mind-map-actions";
import { type MindMapSave } from "./mind-map-save-button";
import { useMindMapSaves } from "./use-mind-map-saves";

const DRAWING_POLL_MS = 4000;
const WRITING_POLL_MS = 15_000;

export type MindMapShown = MindMapStatus | "refused" | "unreachable";

export type MindMapRequest = ReturnType<typeof useMindMapRequest>;

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
  const [savedNow, setSavedNow] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const order = useReadOrder();
  const { chapterId, status } = view;

  if (localView !== view) {
    setLocalView(view);
    setLocal(null);
    setSavedNow(null);
  }

  const saves = useMindMapSaves({
    onSaved: (_target, saved) => {
      order.supersedeReads();
      setSavedNow(saved);
    },
    save: actions.save,
  });

  const saveState = {
    saved: savedNow ?? view.saved,
    target: { kind: "chapter", targetId: chapterId },
  } as const;

  const save: MindMapSave = {
    onToggle: () => saves.toggle(saveState),
    saved: saves.isSaved(saveState),
  };

  const showStatus = (next: MindMapStatus) => {
    if (next !== status) {
      onViewChange({ ...view, status: next });
    }
  };

  const showRead = async (): Promise<boolean> => {
    const read = order.startRead();
    const next = await actions.read(chapterId).catch(() => null);

    if (next && read.isLatest()) {
      onViewChange(next);
    }

    return next !== null;
  };

  const poll = usePoll({
    active: local === null && (status === "drawing" || status === "writingLessons"),
    intervalMs: status === "writingLessons" ? WRITING_POLL_MS : DRAWING_POLL_MS,
    key: status,
    onPoll: async () => {
      const read = order.startRead();
      const next = await actions.readStatus(chapterId);

      if (!read.isLatest()) {
        return;
      }

      if (next === null || (next === "ready" && !(await showRead()))) {
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
    order.supersedeReads();

    if (outcome.status === "refused") {
      setLocal({ limit: outcome.limit, shown: "refused" });
      return;
    }

    if (outcome.status === "failed" || (outcome.status === "ready" && !(await showRead()))) {
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
    reread: () => void showRead(),
    retry: isStuck ? poll.restart : create,
    save,
    shown: isStuck ? "unreachable" : (local?.shown ?? status),
  };
}
