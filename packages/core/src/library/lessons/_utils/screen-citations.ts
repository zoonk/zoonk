import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type ScreenMaterialRef } from "@zoonk/ai/tasks/material/cite";
import { getScreenTexts } from "../../quality/_utils/screen-texts";
import { type MaterialPage, findMaterialPage } from "../../sources/material-pages";

export type ScreenCitation = { page: number | null; sourceId: string };

export function describeWrittenScreen(screen: WrittenScreen): string {
  return getScreenTexts(screen)
    .map((text) => text.text)
    .join(" ");
}

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
