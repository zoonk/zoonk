"use client";

import { type SourceReadStatus } from "@zoonk/core/library/sources/contract";
import { useEffect, useEffectEvent } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type AttachedSource, type GoalAttachActions } from "../onboarding-actions";

const READ_CHECK_MS = 3000;

export type SettledRead = { id: string; readStatus: Exclude<SourceReadStatus, "reading"> };

export function settleReads<TSource extends AttachedSource>({
  settled,
  sources,
}: {
  settled: readonly SettledRead[];
  sources: readonly TSource[];
}): TSource[] {
  return sources.map((source) => {
    const read = settled.find((item) => item.id === source.id);
    return read ? { ...source, readStatus: read.readStatus } : source;
  });
}

/**
 * Asks again while any of the shown sources is still being read, a check that couldn't reach us
 * included, and again when the learner comes back to the page, until every read settles.
 */
export function useFollowReading({
  onSettled,
  read,
  sources,
}: {
  onSettled: (settled: SettledRead[]) => void;
  read: GoalAttachActions["readStatus"];
  sources: readonly AttachedSource[];
}) {
  const reading = sources.filter((source) => source.readStatus === "reading").map(({ id }) => id);

  const { restart } = usePoll({
    active: reading.length > 0,
    intervalMs: READ_CHECK_MS,
    key: reading.join(" "),
    onPoll: async () => {
      const checked = await Promise.all(
        reading.map(async (id) => ({ id, readStatus: await read(id) })),
      );

      const settled = checked.filter(
        (item): item is SettledRead => item.readStatus !== null && item.readStatus !== "reading",
      );

      if (settled.length > 0) {
        onSettled(settled);
      }
    },
    startNow: false,
  });

  const checkAgain = useEffectEvent(() => {
    if (document.visibilityState === "visible") {
      restart();
    }
  });

  useEffect(() => {
    document.addEventListener("visibilitychange", checkAgain);
    return () => document.removeEventListener("visibilitychange", checkAgain);
  }, []);
}
