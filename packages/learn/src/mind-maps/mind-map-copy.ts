"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { useExtracted } from "next-intl";
import { type MindMapShown } from "./use-mind-map-request";

/**
 * Where the row sits changes only its words: the chapter page names it "Mind map", the moment a
 * chapter ends and the Mind maps page name the chapter. The Mind maps page (`library`) uses the
 * row only for maps not made yet.
 */
export type MindMapRowPlace = "chapter" | "finish" | "library";

/** The Mind maps page says once, above its rows, what writing the lessons costs (`NotMadeYet`). */
function useAvailableLine({ place, plus, view }: MindMapCopyInput): string | null {
  const t = useExtracted();
  const writesLessons = view.lessonsToWrite > 0;

  const count = view.lessonsToWrite;

  const offerLine =
    place === "finish" ? t("A mind map of its main ideas") : t("Its main ideas in one picture");

  if (writesLessons && place === "library") {
    return null;
  }

  if (writesLessons) {
    return plus
      ? offerLine
      : t(
          "{count, plural, one {# lesson gets written first and counts toward your free lessons.} other {# lessons get written first and count toward your free lessons.}}",
          { count },
        );
  }

  return place === "library" ? null : offerLine;
}

export type MindMapCopyInput = {
  place: MindMapRowPlace;
  plus: boolean;
  shown: MindMapShown;
  view: ChapterMindMapView;
};

function useReadyLine({ place, view }: MindMapCopyInput): string | null {
  const t = useExtracted();

  if (!view.image) {
    return t("Shown as text");
  }

  if (place === "finish") {
    return t("Mind map ready");
  }

  return place === "chapter" ? t("Its main ideas in one picture") : null;
}

export function useStateLines(input: MindMapCopyInput): {
  hint: string | null;
  line: string | null;
} {
  const t = useExtracted();
  const available = useAvailableLine(input);
  const ready = useReadyLine(input);

  if (input.shown === "writingLessons") {
    return {
      hint: t("This takes a few minutes. You can leave; it'll be here."),
      line: t("Writing the lessons, then the mind map…"),
    };
  }

  if (input.shown === "drawing") {
    return {
      hint: t("About half a minute. You can leave; it'll be here."),
      line: t("Drawing the mind map…"),
    };
  }

  if (input.shown === "failed") {
    return { hint: null, line: t("It couldn't be made this time.") };
  }

  if (input.shown === "unreachable") {
    return { hint: null, line: t("We couldn't reach the server. Check your connection.") };
  }

  return { hint: null, line: input.shown === "ready" ? ready : available };
}
