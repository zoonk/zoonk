"use server";

import { searchCatalog } from "@zoonk/core/catalog/search";
import { getExamView } from "@zoonk/core/exams/view/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { normalizeString } from "@zoonk/utils/string";

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
async function loadPlanNames() {
  const result = await getSyllabusView();

  if (result.status !== "ready") {
    return { chapters: [], subjects: [] };
  }

  const { goal, subjects } = result.syllabus;

  return {
    chapters: subjects.flatMap((subject) =>
      subject.chapters.flatMap(({ chapterId, title }) =>
        chapterId
          ? [{ chapterId, subject: subject.shortName, title, unit: goal.kind === "language" }]
          : [],
      ),
    ),
    subjects: subjects.map(({ key, name, shortName }) => ({ key, name, shortName })),
  };
}

/** The client localizes mock names before matching; no English query is assumed here. */
async function loadMocks() {
  const result = await getExamView({});

  if (result.status !== "ready") {
    return [];
  }

  return result.exam.mocks.flatMap(({ blockId, number }) => (blockId ? [{ blockId, number }] : []));
}

export type PalettePlan = Awaited<ReturnType<typeof loadPlanNames>> & {
  mocks: Awaited<ReturnType<typeof loadMocks>>;
};

/** Read once when the palette opens: the palette matches these names itself as the learner types. */
export async function loadPalettePlanAction(): Promise<PalettePlan> {
  const [plan, mocks] = await Promise.all([loadPlanNames(), loadMocks()]);
  return { ...plan, mocks };
}

export async function searchCatalogAction(params: { language: string; query: string }) {
  const catalog = await searchCatalog(params);

  return {
    chapters: rankCatalogResults({ query: params.query, results: catalog.chapters }),
    courses: rankCatalogResults({ query: params.query, results: catalog.courses }),
  };
}

export type CatalogSearchResults = Awaited<ReturnType<typeof searchCatalogAction>>;
