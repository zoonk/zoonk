"use client";

import { type MindMapAllowanceStop } from "@zoonk/core/mind-maps/contract";
import { useState } from "react";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { useReadOrder } from "../_utils/use-read-order";
import { useRereadServed, useServedState } from "../_utils/use-served-state";
import {
  type MindMapsPage,
  type MindMapsPageChapter,
  toMindMapsPage,
} from "./_utils/mind-maps-page";
import { type MindMapLibraryActions, type MindMapRequestOutcome } from "./mind-map-actions";
import { type SavedMapTarget, useMindMapSaves } from "./use-mind-map-saves";

const DRAWING_POLL_MS = 5000;
const WRITING_POLL_MS = 15_000;

/**
 * What only this device knows: the server keeps no refusal, and can't say it wasn't reached. A read
 * of the list that starts after `failedAt` and comes through clears it, as on iOS and Android.
 */
type RowNote = { failedAt: number; limit?: MindMapLimit; shown: "refused" | "unreachable" };

type Bulk =
  | { status: "idle" | "sending"; stop: MindMapAllowanceStop | null }
  | { failedAt: number; status: "unreachable"; stop: null };

function withStatus({
  chapterIds,
  page,
  status,
}: {
  chapterIds: readonly string[];
  page: MindMapsPage;
  status: MindMapsPageChapter["status"];
}): MindMapsPage {
  return {
    ...page,
    chapters: page.chapters.map((chapter) =>
      chapterIds.includes(chapter.chapterId) ? { ...chapter, status } : chapter,
    ),
  };
}

function withoutSaved(page: MindMapsPage, { kind, targetId }: SavedMapTarget): MindMapsPage {
  return {
    ...page,
    chapters: page.chapters.map((chapter) =>
      kind === "chapter" && chapter.chapterId === targetId ? { ...chapter, saved: false } : chapter,
    ),
    saved: page.saved.filter((saved) => saved.kind !== kind || saved.targetId !== targetId),
  };
}

/**
 * The Mind maps page's state: what the server sent, kept current by one read of the list while
 * any map is on its way, with the learner's own taps (create one, create all, remove a save).
 */
export function useMindMapsLibrary({
  actions,
  served,
}: {
  actions: MindMapLibraryActions;
  served: MindMapsPage;
}) {
  const [page, setPage] = useServedState(served);
  const [notes, setNotes] = useState<ReadonlyMap<string, RowNote>>(new Map());
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [bulk, setBulk] = useState<Bulk>({ status: "idle", stop: null });
  const order = useReadOrder();

  const note = (chapterId: string, next: Omit<RowNote, "failedAt"> | null) => {
    const failedAt = order.now();

    setNotes((current) => {
      const others = [...current].filter(([id]) => id !== chapterId);
      return new Map(next ? [...others, [chapterId, { ...next, failedAt }]] : others);
    });
  };

  const saves = useMindMapSaves({
    onSaved: (target, saved) => {
      order.supersedeReads();

      if (!saved) {
        setPage((current) => withoutSaved(current, target));
      }
    },
    save: actions.save,
  });

  const refresh = async () => {
    const read = order.startRead();
    const listed = await actions.list();

    if (!listed) {
      throw new Error("The mind maps couldn't be read.");
    }

    setNotes((current) => {
      const kept = [...current].filter(([, entry]) => entry.failedAt >= read.started);
      return kept.length === current.size ? current : new Map(kept);
    });

    setBulk((current) =>
      current.status === "unreachable" && current.failedAt < read.started
        ? { status: "idle", stop: null }
        : current,
    );

    if (read.isLatest()) {
      setPage(toMindMapsPage(listed));
    }
  };

  useRereadServed(served, () => void refresh().catch(() => null));

  const isDrawing = page.chapters.some((chapter) => chapter.status === "drawing");
  const isWriting = page.chapters.some((chapter) => chapter.status === "writingLessons");

  const poll = usePoll({
    active: isDrawing || isWriting,
    intervalMs: isDrawing ? DRAWING_POLL_MS : WRITING_POLL_MS,
    key: isDrawing ? "drawing" : "writing",
    onPoll: refresh,
    startNow: false,
    // The server turns a run that stops reporting into `failed`; writing lessons can outlast any limit here.
    timeoutMs: Number.POSITIVE_INFINITY,
  });

  const settle = async (chapterId: string, outcome: MindMapRequestOutcome) => {
    if (outcome.status === "refused") {
      note(chapterId, { limit: outcome.limit, shown: "refused" });
      return;
    }

    if (outcome.status === "failed") {
      note(chapterId, { shown: "unreachable" });
      return;
    }

    const { status } = outcome;

    if (status === "drawing" || status === "writingLessons") {
      setPage((current) => withStatus({ chapterIds: [chapterId], page: current, status }));
      // The create offer still counts this chapter until the list is read again.
      void refresh().catch(() => null);
      return;
    }

    await refresh().catch(() => note(chapterId, { shown: "unreachable" }));
  };

  const create = async (chapterId: string) => {
    setSending((current) => new Set(current).add(chapterId));
    note(chapterId, null);

    const outcome = await actions
      .request(chapterId)
      .catch((): MindMapRequestOutcome => ({ status: "failed" }));

    await settle(chapterId, outcome);
    setSending((current) => new Set([...current].filter((id) => id !== chapterId)));
  };

  const createAll = async () => {
    setBulk({ status: "sending", stop: null });
    const started = await actions.requestAll().catch(() => null);

    if (!started) {
      setBulk({ failedAt: order.now(), status: "unreachable", stop: null });
      return;
    }

    setPage((current) =>
      withStatus({ chapterIds: started.accepted, page: current, status: "drawing" }),
    );

    await refresh().catch(() => null);

    // The offer can't foresee every refusal (a guest's shared day), so the answer's own reason shows.
    setBulk({ status: "idle", stop: started.accepted.length === 0 ? started.stop : null });
  };

  return {
    bulk: { ...bulk, createAll: () => void createAll() },
    follower: { isStuck: poll.status === "failed", retry: poll.restart },
    page,
    row: (chapter: MindMapsPageChapter) => {
      const local = notes.get(chapter.chapterId);
      const start = () => void create(chapter.chapterId);

      return {
        // A failed map's row offers its own free retry, whatever stops a new map.
        create: page.createOffer.stop === null ? start : undefined,
        isPending: sending.has(chapter.chapterId),
        limit: local?.limit ?? null,
        retry: start,
        shown: local?.shown ?? chapter.status,
      };
    },
    saves,
  };
}

export type MindMapsLibrary = ReturnType<typeof useMindMapsLibrary>;
