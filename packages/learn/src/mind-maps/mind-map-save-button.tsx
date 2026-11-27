"use client";

import { useExtracted } from "next-intl";
import { SaveButton, type SaveButtonProps, type SaveToggle } from "../saves/save-button";

export type MindMapSave = SaveToggle;

/** A saved mind map's "Saved": its own id, since other saved things agree differently in some languages. */
export function SavedLabel() {
  const t = useExtracted();

  return t({
    description: "A mind map the learner saved: the Save button's state, and a mark on its row.",
    id: "mindMapSaved",
    message: "Saved",
  });
}

function useRowLabels(title: string) {
  const t = useExtracted();

  return {
    save: t("Save {title}", { title }),
    saved: t({
      description:
        "Read aloud for the bookmark on a saved mind map's row, which removes it: says the map {title} is saved.",
      id: "mindMapSavedTitle",
      message: "Saved {title}",
      values: { title },
    }),
  };
}

/** `title` names a row's bookmark after its map, so a list of them doesn't read "Saved, Saved". */
export function MindMapSaveButton({ title, ...props }: SaveButtonProps & { title?: string }) {
  const t = useExtracted();
  const rowLabels = useRowLabels(title ?? "");
  const labels = title ? rowLabels : { save: t("Save"), saved: <SavedLabel /> };

  return <SaveButton labels={labels} slot="mind-map-save" {...props} />;
}
