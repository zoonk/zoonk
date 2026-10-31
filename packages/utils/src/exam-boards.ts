import { namesMatchAcrossSpellings } from "./name-words";
import { normalizeString } from "./string";

type ExamBoard = { domains: readonly string[]; names: readonly string[] };

/** Each board under every name it's known by, its full name and former names included. */
export const BRAZILIAN_EXAM_BOARDS: readonly ExamBoard[] = [
  {
    domains: ["cebraspe.org.br"],
    names: [
      "cebraspe",
      "cespe",
      "centro brasileiro de pesquisa em avaliacao e selecao e de promocao de eventos",
    ],
  },
  { domains: ["fgv.br"], names: ["fgv", "fundacao getulio vargas"] },
  {
    domains: ["vunesp.com.br"],
    names: ["vunesp", "fundacao para o vestibular da universidade estadual paulista"],
  },
  { domains: ["concursosfcc.com.br"], names: ["fcc", "fundacao carlos chagas"] },
  { domains: ["cesgranrio.org.br"], names: ["cesgranrio"] },
  { domains: ["ibfc.org.br"], names: ["ibfc", "instituto brasileiro de formacao e capacitacao"] },
  { domains: ["institutoaocp.org.br"], names: ["aocp"] },
  { domains: ["idecan.org.br"], names: ["idecan"] },
  { domains: ["quadrix.org.br"], names: ["quadrix"] },
  { domains: ["consulplan.net"], names: ["consulplan"] },
  { domains: ["fundatec.org.br"], names: ["fundatec"] },
];

/** Whole words only, ignoring case, accents and punctuation: "FGV" names FGV, "FGVx" doesn't. */
export function mentionsName({ name, text }: { name: string; text: string }): boolean {
  const words = normalizeString(text)
    .replaceAll(/[^\w ]/gu, " ")
    .replaceAll(/\s+/gu, " ");

  return ` ${words} `.includes(` ${name} `);
}

function findBoard(name: string): ExamBoard | undefined {
  return BRAZILIAN_EXAM_BOARDS.find((board) =>
    board.names.some((alias) => mentionsName({ name: alias, text: name })),
  );
}

/**
 * `different` only when the names can't be one board: two known boards, or a known board and a
 * name that isn't one of its names. Two unknown names that don't match are `unknown`, since one may
 * be the other's acronym.
 */
export function compareBoards(first: string, second: string): "different" | "same" | "unknown" {
  const firstBoard = findBoard(first);
  const secondBoard = findBoard(second);

  if (firstBoard && secondBoard) {
    return firstBoard === secondBoard ? "same" : "different";
  }

  if (namesMatchAcrossSpellings(first, second)) {
    return "same";
  }

  return firstBoard || secondBoard ? "different" : "unknown";
}

/** Past papers count only from the current board's editions, or any edition's while it's unknown. */
export function isFromCurrentBoard({
  board,
  current,
}: {
  board: string | null;
  current: string | null;
}): boolean {
  return !current || (board !== null && compareBoards(board, current) === "same");
}
