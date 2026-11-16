import { normalizeString } from "@zoonk/utils/string";
import { matchesPaletteSearch } from "./command-palette-items";
import { type CatalogSearchResults, type PalettePlan } from "./search-courses-action";

const MAX_PLAN_SUBJECTS = 4;
const MAX_PLAN_CHAPTERS = 6;

export type PaletteSearchResults = {
  catalog: CatalogSearchResults & { showsCourse: boolean };
  mocks: PalettePlan["mocks"];
  plan: Pick<PalettePlan, "chapters" | "subjects"> & { showsSubject: boolean };
};

/**
 * A name every row shares is said once by its own row, so each row keeps its width for its title;
 * rows from different courses or subjects keep theirs, which tells them apart.
 */
function isSaidOnce({ details, names }: { details: string[]; names: string[] }): boolean {
  const said = new Set(names.map((name) => normalizeString(name)));
  const shared = new Set(details.map((detail) => normalizeString(detail)));
  const [detail] = shared;

  return shared.size === 1 && detail !== undefined && said.has(detail);
}

/** A catalog course or chapter that's in the learner's matched plan is listed once, as theirs. */
export function toPaletteSearchResults({
  catalog,
  plan,
  query,
}: {
  catalog: CatalogSearchResults;
  plan: PalettePlan;
  query: string;
}): PaletteSearchResults {
  const matchedChapters = plan.chapters.filter((chapter) =>
    matchesPaletteSearch({ query, value: chapter.title }),
  );

  const chapters = matchedChapters.slice(0, MAX_PLAN_CHAPTERS);

  const subjects = plan.subjects
    .filter((subject) =>
      matchesPaletteSearch({ query, value: `${subject.name} ${subject.shortName}` }),
    )
    .slice(0, MAX_PLAN_SUBJECTS);

  const planChapterIds = new Set(matchedChapters.map((chapter) => chapter.chapterId));
  const subjectNames = subjects.flatMap((subject) => [subject.name, subject.shortName]);
  const planCourses = new Set(subjectNames.map((name) => normalizeString(name)));

  const courses = catalog.courses.filter(
    (course) => !planCourses.has(normalizeString(course.title)),
  );

  const catalogChapters = catalog.chapters.filter((chapter) => !planChapterIds.has(chapter.id));

  return {
    catalog: {
      chapters: catalogChapters,
      courses,
      showsCourse: !isSaidOnce({
        details: catalogChapters.map((chapter) => chapter.courseTitle),
        names: [...courses.map((course) => course.title), ...subjectNames],
      }),
    },
    mocks: plan.mocks,
    plan: {
      chapters,
      showsSubject: !isSaidOnce({
        details: chapters.map((chapter) => chapter.subject),
        names: subjectNames,
      }),
      subjects,
    },
  };
}
