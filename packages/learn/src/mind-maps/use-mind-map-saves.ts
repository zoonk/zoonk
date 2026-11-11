"use client";

import { type SaveMindMapInput } from "@zoonk/core/mind-maps/contract";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { type SaveMindMap } from "./mind-map-actions";

export type SavedMapTarget = Pick<SaveMindMapInput, "kind" | "targetId">;

export function toSavedMapKey({ kind, targetId }: SavedMapTarget): string {
  return `${kind}:${targetId}`;
}

type Wanted = ReadonlyMap<string, boolean>;

function without(wanted: Wanted, key: string): Wanted {
  return new Map([...wanted].filter(([other]) => other !== key));
}

/**
 * Shows the learner's choice at once and sends it as the state they want, one request at a time
 * for each map, so quick taps end on the last one. A save that fails goes back and says so.
 * `onSaved` hears what the server stored: the caller keeps that, this only what's on its way.
 */
export function useMindMapSaves({
  onSaved,
  save,
}: {
  onSaved: (target: SavedMapTarget, saved: boolean) => void;
  save: SaveMindMap;
}) {
  const t = useExtracted();
  const [wanted, setWanted] = useState<Wanted>(new Map());
  const sending = useRef(new Map<string, boolean>());

  const settle = (key: string) => {
    sending.current.delete(key);
    setWanted((current) => without(current, key));
  };

  const send = async ({ stored, target }: { stored: boolean; target: SavedMapTarget }) => {
    const key = toSavedMapKey(target);
    const next = sending.current.get(key);

    if (next === undefined || next === stored) {
      settle(key);
      return;
    }

    const result = await save({ ...target, saved: next }).catch(() => null);

    if (result === null) {
      settle(key);

      showErrorToast(
        next ? t("Couldn't save this map. Try again.") : t("Couldn't remove this map. Try again."),
      );

      return;
    }

    onSaved(target, result);
    await send({ stored: result, target });
  };

  return {
    isSaved: ({ saved, target }: { saved: boolean; target: SavedMapTarget }) =>
      wanted.get(toSavedMapKey(target)) ?? saved,
    toggle: ({ saved, target }: { saved: boolean; target: SavedMapTarget }) => {
      const key = toSavedMapKey(target);
      const next = !(sending.current.get(key) ?? saved);
      const isSending = sending.current.has(key);

      sending.current.set(key, next);
      setWanted((current) => new Map(current).set(key, next));

      if (!isSending) {
        void send({ stored: saved, target });
      }
    },
  };
}
