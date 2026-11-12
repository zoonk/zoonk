const SEPARATORS = /[\s\-‐'’().,/]+/gu;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(SEPARATORS, " ")
    .trim();
}

/**
 * Ignores case and accents and matches the start of any word, so "uni" finds both "Estados Unidos"
 * and "Reino Unido", and "eua" doesn't find "Venezuela".
 */
export function matchesCountry({ name, query }: { name: string; query: string }): boolean {
  const wanted = normalize(query);
  return wanted === "" || ` ${normalize(name)}`.includes(` ${wanted}`);
}

/**
 * Until the full list is ready a search covers only the suggested countries, so finding none of
 * those isn't "no country found": the list's loading or its failure with Try again shows instead.
 */
export function foundNoCountry({
  found,
  searching,
  status,
}: {
  found: number;
  searching: boolean;
  status: "failed" | "loading" | "ready";
}): boolean {
  return searching && found === 0 && status === "ready";
}
