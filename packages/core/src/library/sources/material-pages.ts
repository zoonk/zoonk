import { normalizeString } from "@zoonk/utils/string";
import { PAGE_BREAK, PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE } from "./source-contract";

/** One of the learner's own files or pasted texts, as lessons built from it read it. */
export type MaterialSource = { id: string; mimeType: string | null; text: string; title: string };

/**
 * A page of the learner's material with the short reference prompts use for it: `S1:4` is the
 * first source's page (or slide) 4. Material without pages (Word, text) is cut into sections,
 * which are cited by their source alone, so `page` is null.
 */
export type MaterialPage = {
  page: number | null;
  ref: string;
  sourceId: string;
  text: string;
  title: string;
  unit: "page" | "section" | "slide";
};

/** Text without pages is cut near this size at a paragraph break, so retrieval can pick parts. */
const SECTION_CHARACTERS = 2000;
/** What one lesson reads from the material: a few pages, enough for one idea and its context. */
const LESSON_MATERIAL_CHARACTERS = 12_000;
/** Words shorter than this ("the", "de", "and") say nothing about what a page is about. */
const MIN_TERM_LENGTH = 4;
/** How much of each page the index shows: its title line and what follows. */
const INDEX_LINE_CHARACTERS = 160;

/** Slide decks have slides, PDFs have pages, and everything else is cut into sections. */
export function getMaterialUnit(mimeType: string | null): MaterialPage["unit"] {
  if (mimeType === PPTX_CONTENT_TYPE) {
    return "slide";
  }

  return mimeType === PDF_CONTENT_TYPE ? "page" : "section";
}

/** Cuts unpaged text into sections at paragraph breaks, each about `SECTION_CHARACTERS` long. */
function toSections(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const starts = paragraphs.map((_, index) => {
    const before = paragraphs.slice(0, index).join("\n\n");
    return Math.floor(before.length / SECTION_CHARACTERS);
  });

  return Object.values(Object.groupBy(paragraphs, (_, index) => String(starts[index] ?? 0))).map(
    (group) => (group ?? []).join("\n\n"),
  );
}

function toSourcePages({
  index,
  source,
}: {
  index: number;
  source: MaterialSource;
}): MaterialPage[] {
  const unit = getMaterialUnit(source.mimeType);
  const sourceRef = `S${index + 1}`;

  if (unit === "section") {
    return toSections(source.text).map((text, section) => ({
      page: null,
      ref: `${sourceRef}:${section + 1}`,
      sourceId: source.id,
      text,
      title: source.title,
      unit,
    }));
  }

  return source.text
    .split(PAGE_BREAK)
    .map((text, page) => ({
      page: page + 1,
      ref: `${sourceRef}:${page + 1}`,
      sourceId: source.id,
      text: text.trim(),
      title: source.title,
      unit,
    }))
    .filter((page) => page.text.length > 0);
}

/** Every page of the learner's material, in order, each with its reference. */
export function toMaterialPages(sources: readonly MaterialSource[]): MaterialPage[] {
  return sources.flatMap((source, index) => toSourcePages({ index, source }));
}

function toTerms(text: string): Set<string> {
  return new Set(
    normalizeString(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= MIN_TERM_LENGTH),
  );
}

function countShared({ page, terms }: { page: MaterialPage; terms: Set<string> }): number {
  return [...toTerms(page.text)].filter((term) => terms.has(term)).length;
}

type RankedPage = { page: MaterialPage; position: number; score: number };

/** Pages sharing at least `minShared` of the lesson's words, the most shared first. */
function rankPages({
  minShared,
  pages,
  query,
}: {
  minShared: number;
  pages: readonly MaterialPage[];
  query: string;
}): RankedPage[] {
  const terms = toTerms(query);

  return pages
    .map((page, position) => ({ page, position, score: countShared({ page, terms }) }))
    .filter((entry) => entry.score >= minShared)
    .toSorted((first, second) => second.score - first.score || first.position - second.position);
}

/** The candidates that fit within `maxCharacters`, best first, returned in the pages' order. */
function fitPages({
  candidates,
  maxCharacters,
  pages,
}: {
  candidates: readonly RankedPage[];
  maxCharacters: number;
  pages: readonly MaterialPage[];
}): MaterialPage[] {
  const picked = candidates.reduce<{ positions: number[]; size: number }>(
    (selection, entry) =>
      selection.size + entry.page.text.length > maxCharacters
        ? selection
        : {
            positions: [...selection.positions, entry.position],
            size: selection.size + entry.page.text.length,
          },
    { positions: [], size: 0 },
  );

  return picked.positions
    .toSorted((first, second) => first - second)
    .flatMap((position) => {
      const page = pages[position];
      return page ? [page] : [];
    });
}

/**
 * The pages one lesson reads: all of them when the material is short, otherwise the pages that
 * share the most words with the lesson (its title, description and skills), kept in their order
 * and within the size a lesson prompt allows; the first pages when none share a word.
 */
export function selectMaterialPages({
  maxCharacters = LESSON_MATERIAL_CHARACTERS,
  pages,
  query,
}: {
  maxCharacters?: number;
  pages: readonly MaterialPage[];
  query: string;
}): MaterialPage[] {
  const total = pages.reduce((sum, page) => sum + page.text.length, 0);

  if (total <= maxCharacters) {
    return [...pages];
  }

  const ranked = rankPages({ minShared: 1, pages, query });

  // Nothing in common: the material's first pages are the best guess.
  const candidates =
    ranked.length > 0 ? ranked : pages.map((page, position) => ({ page, position, score: 0 }));

  return fitPages({ candidates, maxCharacters, pages });
}

/**
 * The passages of public documents (a law, an exam notice) a shared lesson's facts may come from:
 * only those that share at least `minShared` words with the lesson, the closest first, kept in
 * their order within `maxCharacters`. Unlike a learner's material, a lesson may need none of them,
 * so nothing is picked when nothing matches.
 */
export function selectSourcePages({
  maxCharacters,
  minShared,
  pages,
  query,
}: {
  maxCharacters: number;
  minShared: number;
  pages: readonly MaterialPage[];
  query: string;
}): MaterialPage[] {
  return fitPages({ candidates: rankPages({ minShared, pages, query }), maxCharacters, pages });
}

function describePage(page: MaterialPage): string {
  if (page.page === null) {
    return page.title;
  }

  return `${page.title}, ${page.unit} ${page.page}`;
}

/** Pages as prompts read them: each in a tag with its reference, so a model can cite it. */
export function formatMaterialPages(pages: readonly MaterialPage[]): string {
  return pages
    .map((page) => `<page ref="${page.ref}" of="${describePage(page)}">\n${page.text}\n</page>`)
    .join("\n");
}

/** One line per page, for planning a whole curriculum from the material without reading it all. */
function formatMaterialIndex(pages: readonly MaterialPage[]): string {
  return pages
    .map((page) => {
      const line = page.text.replaceAll(/\s+/gu, " ").slice(0, INDEX_LINE_CHARACTERS);
      return `[${describePage(page)}] ${line}`;
    })
    .join("\n");
}

/**
 * The material for planning a whole curriculum from it: every page in full when it fits in
 * `maxCharacters` (a teacher's summary, a short handout), so nothing it says is lost, else one
 * line per page (see `formatMaterialIndex`).
 */
export function formatMaterialOverview({
  maxCharacters,
  pages,
}: {
  maxCharacters: number;
  pages: readonly MaterialPage[];
}): string {
  const full = formatMaterialPages(pages);
  return full.length <= maxCharacters ? full : formatMaterialIndex(pages).slice(0, maxCharacters);
}

/** The page a model's reference points at, or null for a reference to nothing it was given. */
export function findMaterialPage({
  pages,
  ref,
}: {
  pages: readonly MaterialPage[];
  ref: string | null;
}): MaterialPage | null {
  return ref ? (pages.find((page) => page.ref === ref.trim()) ?? null) : null;
}
