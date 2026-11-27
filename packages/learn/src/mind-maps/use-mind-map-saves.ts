"use client";

import { type SaveMindMapInput } from "@zoonk/core/mind-maps/contract";
import { useExtracted } from "next-intl";
import { useSaves } from "../saves/use-saves";
import { type SaveMindMap } from "./mind-map-actions";

export type SavedMapTarget = Pick<SaveMindMapInput, "kind" | "targetId">;

export function toSavedMapKey({ kind, targetId }: SavedMapTarget): string {
  return `${kind}:${targetId}`;
}

export function useMindMapSaves({
  onSaved,
  save,
}: {
  onSaved?: (target: SavedMapTarget, saved: boolean) => void;
  save: SaveMindMap;
}) {
  const t = useExtracted();

  return useSaves<SavedMapTarget>({
    failed: {
      remove: t("Couldn't remove this map. Try again."),
      save: t("Couldn't save this map. Try again."),
    },
    keyOf: toSavedMapKey,
    onSaved,
    save: (target, saved) => save({ ...target, saved }),
  });
}
