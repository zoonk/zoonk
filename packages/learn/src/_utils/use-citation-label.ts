import { type MaterialCitation } from "@zoonk/core/library/sources/material-question-contract";
import { useExtracted } from "next-intl";

/** "Class 5, slide 4": the page of the learner's own material, so they can open it there. */
export function useCitationLabel() {
  const t = useExtracted();

  return ({ page, title, unit }: MaterialCitation): string => {
    if (page === null) {
      return title;
    }

    return unit === "slide"
      ? t("{title}, slide {page}", { page: String(page), title })
      : t("{title}, page {page}", { page: String(page), title });
  };
}
