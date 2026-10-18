"use client";

import { type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { useExtracted } from "next-intl";
import { MindMapOutline } from "./mind-map-outline";

/** A title that ends its own sentence ("How small is an atom?") takes no period after it. */
const SENTENCE_END = /[.!?…]$/u;

/** The picture's short text alternative: the map's title and central idea. */
export function useMindMapAlt({ outline, title }: { outline: Outline | null; title: string }) {
  const t = useExtracted();

  if (!outline) {
    return t("Mind map of {chapter}", { chapter: title });
  }

  const values = { idea: outline.centralIdea, title: outline.title };

  return SENTENCE_END.test(outline.title.trim())
    ? t("Mind map: {title} {idea}", values)
    : t("Mind map: {title}. {idea}", values);
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
