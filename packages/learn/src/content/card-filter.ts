import { type ContentCard, type ContentGroup } from "./content-context";

/** The filters both modes offer. Gold is the Mastered state. */
export type CardFilter = "all" | "fading" | "gold" | "new";

export const CARD_FILTERS: readonly CardFilter[] = ["all", "fading", "gold", "new"];

function matchesFilter(card: ContentCard, filter: CardFilter): boolean {
  switch (filter) {
    case "fading":
      return card.fading;
    case "gold":
      return card.state === "mastered";
    case "new":
      return card.state === "new";
    case "all":
      return true;
    default:
      return true;
  }
}

/** Case- and accent-insensitive, so "fotons" finds "fótons". */
function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(card: ContentCard, query: string): boolean {
  if (!query) {
    return true;
  }

  return [card.name, card.description ?? "", card.example ?? ""].some((text) =>
    normalizeSearch(text).includes(query),
  );
}

/**
 * The groups with only the cards that match the search and filter, keeping group order. Groups
 * left empty drop out, so a search shows only where the matches are.
 */
export function filterCardGroups({
  filter,
  groups,
  query,
}: {
  filter: CardFilter;
  groups: readonly ContentGroup[];
  query: string;
}): ContentGroup[] {
  const normalized = normalizeSearch(query);

  if (filter === "all" && !normalized) {
    return [...groups];
  }

  return groups
    .map((group) => ({
      ...group,
      cards: group.cards.filter(
        (card) => matchesFilter(card, filter) && matchesQuery(card, normalized),
      ),
    }))
    .filter((group) => group.cards.length > 0);
}
