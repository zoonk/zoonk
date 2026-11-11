export function splitProfileFavorites(text: string): string[] {
  const seen = new Set<string>();

  return text.split(/[,;、，\r\n]/u).flatMap((item) => {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [trimmed];
  });
}

export function normalizeProfileFavorites(text: string): string {
  return splitProfileFavorites(text).join(", ");
}
