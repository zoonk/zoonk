import { z } from "zod";

/** A map stays readable on one square picture: at most six branches, three points each. */
const MAX_BRANCHES = 6;
const MIN_BRANCHES = 3;
const MAX_POINTS = 3;
const MAX_COLUMNS = 5;
const MIN_COLUMNS = 2;

const branchSchema = z.object({
  drawing: z.string(),
  explanation: z.string(),
  points: z.array(z.string()),
  title: z.string(),
});

const columnSchema = z.object({ name: z.string(), points: z.array(z.string()) });

/** What the model writes; `normalizeMindMapStructure` trims it to what a picture holds. */
export const mindMapStructureSchema = z.object({
  branches: z.array(branchSchema),
  centralIdea: z.string(),
  comparison: z.object({ columns: z.array(columnSchema), title: z.string() }).nullable(),
  summary: z.string(),
  title: z.string(),
});

/** Each branch's sketch is described in English and never lettered. */
export type MindMapStructure = z.infer<typeof mindMapStructureSchema>;

type MindMapHeadings = { centralIdea: string; summary: string };

const HEADINGS: Readonly<Record<string, MindMapHeadings>> = {
  de: { centralIdea: "Kernidee", summary: "Zusammenfassung" },
  en: { centralIdea: "Central idea", summary: "Summary" },
  es: { centralIdea: "Idea central", summary: "Resumen" },
  fr: { centralIdea: "Idée centrale", summary: "Résumé" },
  pt: { centralIdea: "Ideia central", summary: "Resumo" },
};

/** English for a language the app doesn't speak. */
export function getMindMapHeadings(language: string): MindMapHeadings {
  return HEADINGS[language] ?? { centralIdea: "Central idea", summary: "Summary" };
}

/** The map never letters em dashes. */
function cleanText(text: string): string {
  return text
    .replaceAll(/\s*[—–]\s*/gu, ", ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function cleanList({ items, max }: { items: readonly string[]; max: number }): string[] {
  return items
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeComparison(
  comparison: MindMapStructure["comparison"],
): MindMapStructure["comparison"] {
  const columns = (comparison?.columns ?? [])
    .map((column) => ({
      name: cleanText(column.name),
      points: cleanList({ items: column.points, max: MAX_POINTS }),
    }))
    .filter((column) => column.name && column.points.length > 0)
    .slice(0, MAX_COLUMNS);

  const title = cleanText(comparison?.title ?? "");

  return title && columns.length >= MIN_COLUMNS ? { columns, title } : null;
}

/** Null when what's left isn't a map, so the caller writes it again. */
export function normalizeMindMapStructure(raw: MindMapStructure): MindMapStructure | null {
  const branches = raw.branches
    .map((branch) => ({
      drawing: cleanText(branch.drawing),
      explanation: cleanText(branch.explanation),
      points: cleanList({ items: branch.points, max: MAX_POINTS }),
      title: cleanText(branch.title),
    }))
    .filter((branch) => branch.title && branch.explanation)
    .slice(0, MAX_BRANCHES);

  const structure = {
    branches,
    centralIdea: cleanText(raw.centralIdea),
    comparison: normalizeComparison(raw.comparison),
    summary: cleanText(raw.summary),
    title: cleanText(raw.title),
  };

  const isComplete =
    branches.length >= MIN_BRANCHES &&
    Boolean(structure.title && structure.centralIdea && structure.summary);

  return isComplete ? structure : null;
}

/** In reading order; the text check compares a picture's words against these. */
export function listMindMapTexts({
  language,
  structure,
}: {
  language: string;
  structure: MindMapStructure;
}): string[] {
  const headings = getMindMapHeadings(language);

  return [
    structure.title,
    headings.centralIdea,
    structure.centralIdea,
    ...structure.branches.flatMap((branch, index) => [
      `${index + 1}. ${branch.title}`,
      branch.explanation,
      ...branch.points,
    ]),
    ...(structure.comparison
      ? [
          structure.comparison.title,
          ...structure.comparison.columns.flatMap((column) => [column.name, ...column.points]),
        ]
      : []),
    `${headings.summary}: ${structure.summary}`,
  ];
}
