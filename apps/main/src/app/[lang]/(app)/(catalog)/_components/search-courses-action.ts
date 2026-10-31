"use server";

import { searchCatalog } from "@zoonk/core/catalog/search";
import { getExamView } from "@zoonk/core/exams/view/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { normalizeString } from "@zoonk/utils/string";
import { matchesPaletteSearch } from "./command-palette-items";

const MAX_PLAN_SUBJECTS = 4;
const MAX_PLAN_CHAPTERS = 6;

const MIN_DESCRIPTION_QUERY_LENGTH = 5;

function rankCatalogResults<Result extends { title: string }>({
  query,
  results,
}: {
  query: string;
  results: Result[];
}): Result[] {
  const normalizedQuery = normalizeString(query);

  const titleMatches = results.filter((result) =>
    normalizeString(result.title).includes(normalizedQuery),
  );

  if (normalizedQuery.length < MIN_DESCRIPTION_QUERY_LENGTH) {
    return titleMatches;
  }

  const descriptionMatches = results.filter(
    (result) => !normalizeString(result.title).includes(normalizedQuery),
  );

  return [...titleMatches, ...descriptionMatches];
}

/** A chapter whose lessons are still being written has no page yet. */
async function searchPlan(query: string) {
  const result = await getSyllabusView();

  if (result.status !== "ready") {
    return { chapters: [], subjects: [] };
  }

  const { goal, subjects } = result.syllabus;

  const matchingSubjects = subjects
    .filter((subject) =>
      matchesPaletteSearch({ query, value: `${subject.name} ${subject.shortName}` }),
    )
    .slice(0, MAX_PLAN_SUBJECTS)
    .map(({ key, name, shortName }) => ({ key, name, shortName }));

  const matchingChapters = subjects
    .flatMap((subject) =>
      subject.chapters.flatMap(({ chapterId, title }) =>
        chapterId && matchesPaletteSearch({ query, value: title })
          ? [{ chapterId, subject: subject.shortName, title, unit: goal.kind === "language" }]
          : [],
      ),
    )
    .slice(0, MAX_PLAN_CHAPTERS);

  return { chapters: matchingChapters, subjects: matchingSubjects };
}

/** The client localizes mock names before matching; no English query is assumed here. */
async function searchMocks(query: string) {
  if (!query.trim()) {
    return [];
  }

  const result = await getExamView({});

  if (result.status !== "ready") {
    return [];
  }

  return result.exam.mocks.flatMap(({ blockId, number }) => (blockId ? [{ blockId, number }] : []));
}

export type PaletteSearchResults = {
  catalog: Awaited<ReturnType<typeof searchCatalog>>;
  mocks: Awaited<ReturnType<typeof searchMocks>>;
  plan: Awaited<ReturnType<typeof searchPlan>>;
};

export async function searchPaletteAction(params: {
  language: string;
  query: string;
}): Promise<PaletteSearchResults> {
  const [catalog, plan, mocks] = await Promise.all([
    searchCatalog(params),
    searchPlan(params.query),
    searchMocks(params.query),
  ]);

  const planChapterIds = new Set(plan.chapters.map((chapter) => chapter.chapterId));

  return {
    catalog: {
      chapters: rankCatalogResults({
        query: params.query,
        results: catalog.chapters.filter((chapter) => !planChapterIds.has(chapter.id)),
      }),
      courses: rankCatalogResults({ query: params.query, results: catalog.courses }),
    },
    mocks,
    plan,
  };
}
