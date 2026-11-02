import { matchesPaletteSearch } from "./command-palette-items";
import { type CatalogSearchResults, type PalettePlan } from "./search-courses-action";

const MAX_PLAN_SUBJECTS = 4;
const MAX_PLAN_CHAPTERS = 6;

export type PaletteSearchResults = {
  catalog: CatalogSearchResults;
  mocks: PalettePlan["mocks"];
  plan: Pick<PalettePlan, "chapters" | "subjects">;
};

/** A catalog chapter that's in the learner's matched plan is listed once, as theirs. */
export function toPaletteSearchResults({
  catalog,
  plan,
  query,
}: {
  catalog: CatalogSearchResults;
  plan: PalettePlan;
  query: string;
}): PaletteSearchResults {
  const chapters = plan.chapters
    .filter((chapter) => matchesPaletteSearch({ query, value: chapter.title }))
    .slice(0, MAX_PLAN_CHAPTERS);

  const subjects = plan.subjects
    .filter((subject) =>
      matchesPaletteSearch({ query, value: `${subject.name} ${subject.shortName}` }),
    )
    .slice(0, MAX_PLAN_SUBJECTS);

  const planChapterIds = new Set(chapters.map((chapter) => chapter.chapterId));

  return {
    catalog: {
      ...catalog,
      chapters: catalog.chapters.filter((chapter) => !planChapterIds.has(chapter.id)),
    },
    mocks: plan.mocks,
    plan: { chapters, subjects },
  };
}
