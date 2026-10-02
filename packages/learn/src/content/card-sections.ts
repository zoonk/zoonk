import { type ContentGroup } from "./content-context";

type Counts = ContentGroup["counts"];

/**
 * How a section introduces its chapters. With several chapters it shows its title and totals; with
 * one, only its title, since that chapter's row already has the same totals; and when that one
 * chapter has the section's own title ("Writing" in "Writing"), no header at all: the chapter
 * stands in for its section.
 */
type CardSectionHeader = "full" | "none" | "title";

/** One section (a course or exam subject) with its chapters and its totals across all its cards. */
export type CardSection = {
  counts: Counts;
  groups: ContentGroup[];
  header: CardSectionHeader;
  key: string;
  title: string | null;
};

const EMPTY_COUNTS: Counts = { fading: 0, learning: 0, mastered: 0, new: 0, solid: 0, total: 0 };

function addCounts(a: Counts, b: Counts): Counts {
  return {
    fading: a.fading + b.fading,
    learning: a.learning + b.learning,
    mastered: a.mastered + b.mastered,
    new: a.new + b.new,
    solid: a.solid + b.solid,
    total: a.total + b.total,
  };
}

const sectionKey = (group: ContentGroup) => group.section ?? "";

const sameTitle = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Decided from all of a section's chapters, so a search never changes how a section looks. */
function getSectionHeader({
  inSection,
  key,
}: {
  inSection: readonly ContentGroup[];
  key: string;
}): CardSectionHeader {
  const [only, ...others] = inSection;

  if (!only || others.length > 0) {
    return "full";
  }

  return sameTitle(only.title, key) ? "none" : "title";
}

/**
 * The chapters on screen split by section, when the goal has two or more sections; null when it
 * has one, or when every section is just its one same-named chapter, so those goals show their
 * chapters as they are. A section's totals count all its cards, so they don't shrink while a
 * search narrows the chapters.
 */
export function toCardSections({
  all,
  groups,
}: {
  all: readonly ContentGroup[];
  groups: readonly ContentGroup[];
}): CardSection[] | null {
  const bySection = Map.groupBy(all, sectionKey);

  const headers = new Map(
    [...bySection].map(([key, inSection]) => [key, getSectionHeader({ inSection, key })]),
  );

  if (bySection.size < 2 || [...headers.values()].every((header) => header === "none")) {
    return null;
  }

  return [...Map.groupBy(groups, sectionKey)].map(([key, inSection]) => ({
    counts: (bySection.get(key) ?? []).reduce(
      (sum, group) => addCounts(sum, group.counts),
      EMPTY_COUNTS,
    ),
    groups: inSection,
    header: headers.get(key) ?? "full",
    key,
    title: inSection[0]?.section ?? null,
  }));
}
