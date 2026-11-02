"use client";

import { type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { useExtracted } from "next-intl";
import { MindMapOutline } from "./mind-map-outline";

const SENTENCE_END = /[.!?…]$/u;

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
