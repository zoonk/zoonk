import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type ScreenMaterialRef } from "@zoonk/ai/tasks/v2/material/cite";
import { getScreenTexts } from "../../quality/_utils/screen-texts";
import { type MaterialPage, findMaterialPage } from "../../sources/material-pages";

/** The page of the learner's material a screen cites: `page` is null for material without pages. */
export type ScreenCitation = { page: number | null; sourceId: string };

/** An activity's content is JSON text; its prompt is what the learner reads. */
function readActivityPrompt(content: string): string {
  try {
    const parsed: unknown = JSON.parse(content);

    return typeof parsed === "object" && parsed !== null && "prompt" in parsed
      ? String(parsed.prompt)
      : "";
  } catch {
    return "";
  }
}

/** What a learner reads on one written screen, in one line, for matching it to the material. */
export function describeWrittenScreen(screen: WrittenScreen): string {
  if (screen.kind === "activity") {
    return readActivityPrompt(screen.content);
  }

  return getScreenTexts(screen)
    .map((text) => text.text)
    .join(" ");
}

/**
 * Each screen's citation, by position: the page the model picked when the lesson was given that
 * page, otherwise none. A reference to a page the lesson wasn't written from is dropped, since a
 * wrong citation sends the learner to the wrong place.
 */
export function toScreenCitations({
  citations,
  pages,
  screenCount,
}: {
  citations: readonly ScreenMaterialRef[];
  pages: readonly MaterialPage[];
  screenCount: number;
}): (ScreenCitation | null)[] {
  return Array.from({ length: screenCount }, (_, index) => {
    const ref = citations.find((citation) => citation.screen === index + 1)?.ref ?? null;
    const page = findMaterialPage({ pages, ref });

    return page ? { page: page.page, sourceId: page.sourceId } : null;
  });
}
