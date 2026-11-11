import { type LawArticlePiece, splitLawArticlePieces, toArticleNumber } from "./law-articles";
import {
  type MaterialPage,
  type MaterialSource,
  formatMaterialPages,
  rankPages,
  toSourcePages,
} from "./material-pages";

/** What a lesson's planner, writer, reviewer and fixer read of its laws, labels included. */
const LESSON_LAW_CHARACTERS = 12_000;

export type LawPage = {
  /** Null for a text that isn't written in articles. */
  article: Pick<LawArticlePiece, "documentPart" | "number"> | null;
  label: string;
  page: MaterialPage;
};

function toArticlePages({
  index,
  pieces,
  source,
}: {
  index: number;
  pieces: readonly LawArticlePiece[];
  source: MaterialSource;
}): LawPage[] {
  return pieces.map((piece, position) => ({
    article: { documentPart: piece.documentPart, number: piece.number },
    label: piece.label,
    page: {
      page: null,
      ref: `S${index + 1}:${position + 1}`,
      sourceHash: source.contentHash,
      sourceId: source.id,
      text: piece.text,
      title: `${source.title}, ${piece.label}`,
      unit: "section",
    },
  }));
}

function toPageLabel(page: MaterialPage): string {
  return `${page.unit} ${page.ref.split(":").at(-1)}`;
}

/** A law's article pages, or its ordinary pages when it isn't written in articles. */
export function toLawPages({
  index,
  source,
}: {
  index: number;
  source: MaterialSource;
}): LawPage[] {
  const pieces = splitLawArticlePieces(source.text);

  return pieces
    ? toArticlePages({ index, pieces, source })
    : toSourcePages({ index, source }).map((page) => ({
        article: null,
        label: toPageLabel(page),
        page,
      }));
}

export type LawToSelect = {
  /** Articles the lesson is about, such as "Art. 4º"; they only pick text. */
  hints: readonly string[];
  pages: readonly LawPage[];
  /** In the law's language, which can differ from the lesson's. */
  terms: readonly string[];
};

/** Pages sharing a label, such as a revoked wording kept beside its new one, are read together. */
type LabeledUnit = {
  article: LawPage["article"];
  cost: number;
  label: string;
  law: number;
  position: number;
  text: string;
};

type Selection = { chosen: ReadonlySet<LabeledUnit>; left: number };

function toUnits({ law, pages }: { law: number; pages: readonly LawPage[] }): LabeledUnit[] {
  return [...Map.groupBy(pages, (page) => page.label).entries()].map(
    ([label, group], position) => ({
      article: group[0]?.article ?? null,
      cost: formatMaterialPages(group.map((page) => page.page)).length,
      label,
      law,
      position,
      text: group.map((page) => page.page.text).join("\n"),
    }),
  );
}

function rankUnits({ query, units }: { query: string; units: readonly LabeledUnit[] }) {
  return rankPages({ minShared: 0, pages: units, query }).map(({ page, score }) => ({
    score,
    unit: page,
  }));
}

function add({ selection, units }: { selection: Selection; units: readonly LabeledUnit[] }) {
  return units.reduce<Selection>(
    (current, unit) =>
      current.chosen.has(unit) || unit.cost > current.left
        ? current
        : { chosen: new Set([...current.chosen, unit]), left: current.left - unit.cost },
    selection,
  );
}

/** The hinted article in the text's first part that has it: "Art. 1" of the law, not of an amendment. */
function findHintedArticle({
  hint,
  units,
}: {
  hint: string;
  units: readonly LabeledUnit[];
}): LabeledUnit[] {
  const number = toArticleNumber(hint);
  const matching = units.filter((unit) => number !== null && unit.article?.number === number);
  const part = Math.min(...matching.map((unit) => unit.article?.documentPart ?? 1));

  return matching.filter((unit) => unit.article?.documentPart === part);
}

function addHinted({
  query,
  selection,
  units,
}: {
  query: string;
  selection: Selection;
  units: readonly LabeledUnit[];
}): Selection {
  const missing = units.filter((unit) => !selection.chosen.has(unit));
  const cost = missing.reduce((sum, unit) => sum + unit.cost, 0);

  if (cost <= selection.left) {
    return add({ selection, units: missing });
  }

  return add({ selection, units: rankUnits({ query, units }).map(({ unit }) => unit) });
}

function toQuery({ law, query }: { law: LawToSelect; query: string }): string {
  return [query, ...law.terms].join(" ");
}

/**
 * The labels each law's lesson reads: its hinted articles whole first, then the pages sharing the
 * most terms with the lesson, within the lesson's budget.
 */
export function selectLawArticles({
  laws,
  maxCharacters = LESSON_LAW_CHARACTERS,
  query,
}: {
  laws: readonly LawToSelect[];
  maxCharacters?: number;
  query: string;
}): string[][] {
  const units = laws.map((law, index) => toUnits({ law: index, pages: law.pages }));

  const hinted = laws.reduce<Selection>(
    (selection, law, index) =>
      law.hints.reduce(
        (current, hint) =>
          addHinted({
            query: toQuery({ law, query }),
            selection: current,
            units: findHintedArticle({ hint, units: units[index] ?? [] }),
          }),
        selection,
      ),
    { chosen: new Set(), left: maxCharacters },
  );

  const ranked = laws
    .flatMap((law, index) =>
      rankUnits({ query: toQuery({ law, query }), units: units[index] ?? [] }),
    )
    .toSorted(
      (first, second) =>
        second.score - first.score ||
        first.unit.law - second.unit.law ||
        first.unit.position - second.unit.position,
    );

  const { chosen } = add({ selection: hinted, units: ranked.map(({ unit }) => unit) });

  return units.map((lawUnits) =>
    lawUnits.filter((unit) => chosen.has(unit)).map((unit) => unit.label),
  );
}

/** The pages of `labels`, read from the law's current text. */
export function pickLawPages({
  labels,
  pages,
}: {
  labels: readonly string[];
  pages: readonly LawPage[];
}): MaterialPage[] {
  const picked = new Set(labels);
  return pages.filter((page) => picked.has(page.label)).map((page) => page.page);
}
