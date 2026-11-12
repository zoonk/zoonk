function toStem(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.[a-z]+$/u, "");
}

/**
 * Whether a title is only its page's file name, as Planalto titles "l9784.htm" with "L9784". A
 * name without spaces can still be a document's own, such as "COVID-19" or a Chinese title.
 */
export function isFileNameTitle({ title, url }: { title: string; url: string | null }): boolean {
  const fileName = url ? URL.parse(url)?.pathname.split("/").at(-1) : undefined;
  return Boolean(fileName) && toStem(title) === toStem(fileName ?? "");
}
