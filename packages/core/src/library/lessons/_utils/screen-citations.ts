import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type ScreenMaterialRef } from "@zoonk/ai/tasks/v2/material/cite";
import { getScreenTexts } from "../../quality/_utils/screen-texts";
import { type MaterialPage, findMaterialPage } from "../../sources/material-pages";

export type ScreenCitation = { page: number | null; sourceId: string };

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

export function describeWrittenScreen(screen: WrittenScreen): string {
  if (screen.kind === "activity") {
    return readActivityPrompt(screen.content);
  }

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
