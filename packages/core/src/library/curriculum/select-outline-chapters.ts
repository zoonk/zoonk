import { normalizeString } from "@zoonk/utils/string";

export function selectOutlineChapters<
  Chapter extends { skillKeys: readonly string[]; title: string },
>({
  chapters,
  plan,
}: {
  chapters: Chapter[];
  plan: {
    extensions: readonly { skill: { key: string } }[];
    isNewBand: boolean;
    otherChapterTitles: readonly string[];
  };
}): Chapter[] {
  if (plan.isNewBand) {
    return chapters;
  }

  const extended = new Set(plan.extensions.map((extension) => extension.skill.key));
  const titles = new Set(plan.otherChapterTitles.map((title) => normalizeString(title)));
  const isContinuation = (chapter: Chapter) => chapter.skillKeys.some((key) => extended.has(key));

  // An existing title resolves to the existing chapter, so its new lessons would never be written.
  const continuations = new Set(
    chapters
      .filter((chapter) => isContinuation(chapter) && !titles.has(normalizeString(chapter.title)))
      .slice(0, plan.extensions.length),
  );

  return chapters.filter(
    (chapter) =>
      continuations.has(chapter) || (!isContinuation(chapter) && chapter.skillKeys.length > 0),
  );
}
