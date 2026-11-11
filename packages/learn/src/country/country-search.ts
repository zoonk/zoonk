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
