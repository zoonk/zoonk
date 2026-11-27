"use client";

import { useExtracted } from "next-intl";
import { SaveButton, type SaveButtonProps } from "../saves/save-button";

function useLabels(title: string | undefined) {
  const t = useExtracted();

  if (title) {
    return {
      save: t("Save {title}", { title }),
      saved: t({
        description:
          "Read aloud for the bookmark on a saved lesson's row, which removes it: says the lesson {title} is saved.",
        id: "lessonSavedTitle",
        message: "Saved {title}",
        values: { title },
      }),
    };
  }

  return {
    save: t("Save"),
    saved: t({
      description: "Says the lesson is saved to do again later: the bookmark's state.",
      id: "lessonSaved",
      message: "Saved",
    }),
  };
}

/** `title` names a row's bookmark after its lesson, so a list of them doesn't read "Save, Save". */
export function LessonSaveButton({ title, ...props }: SaveButtonProps & { title?: string }) {
  const labels = useLabels(title);
  return <SaveButton labels={labels} slot="lesson-save" {...props} />;
}
