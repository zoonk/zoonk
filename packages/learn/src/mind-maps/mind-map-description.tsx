"use client";

import { type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { useExtracted } from "next-intl";
import { MindMapOutline } from "./mind-map-outline";

/** The picture's short text alternative: the map's title and central idea. */
export function useMindMapAlt({ outline, title }: { outline: Outline | null; title: string }) {
  const t = useExtracted();

  return outline
    ? t("Mind map: {title}. {idea}", { idea: outline.centralIdea, title: outline.title })
    : t("Mind map of {chapter}", { chapter: title });
}

/**
 * The whole map in words for screen readers, which the picture's `aria-describedby` points at:
 * hidden from sight and from reading order, so it's heard once, as the picture's description.
 */
export function MindMapDescription({ id, outline }: { id: string; outline: Outline | null }) {
  if (!outline) {
    return null;
  }

  return (
    <div hidden id={id}>
      <MindMapOutline outline={outline} />
    </div>
  );
}
