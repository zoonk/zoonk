import { namesMatchAcrossSpellings } from "@zoonk/utils/name-words";

/** One board's name may be shortened or spelled another way ("FGV" and "FGV Conhecimento"). */
export function isSameBoard(first: string | null, second: string): boolean {
  return first !== null && namesMatchAcrossSpellings(first, second);
}
