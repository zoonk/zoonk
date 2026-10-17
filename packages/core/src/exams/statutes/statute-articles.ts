/**
 * Brazilian statutes as published (planalto.gov.br) start each article with "Art. 5º" or
 * "Art. 37.", so the text splits on those headings. Articles too short to drill are left out.
 */
const ARTICLE_START = /(?:^|\n)\s*(?<heading>Art\.\s*\d+[º°o]?(?:-[A-Z])?\.?)/gu;
const MIN_ARTICLE_CHARACTERS = 40;
const MAX_ARTICLE_CHARACTERS = 1500;

/** Laws and codes, by the title a notice or source gives them. */
const STATUTE_TITLE = /^(?:lei|decreto|constitui[çc][ãa]o|c[óo]digo|emenda constitucional)\b/iu;
const STATUTE_HOSTS = new Set(["planalto.gov.br", "www.planalto.gov.br"]);

export type StatuteArticleText = { reference: string; text: string };

function toReference(heading: string): string {
  return heading.replaceAll(/\s+/gu, " ").replace(/\.$/u, "").trim();
}

/** The statute's articles in order, each with its heading as the reference ("Art. 5º"). */
export function splitStatuteArticles(text: string): StatuteArticleText[] {
  const matches = [...text.matchAll(ARTICLE_START)];

  return matches.flatMap((match, index) => {
    const heading = match.groups?.heading ?? "";
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const body = text.slice(start, end).replaceAll(/\s+/gu, " ").trim();

    return body.length >= MIN_ARTICLE_CHARACTERS
      ? [{ reference: toReference(heading), text: body.slice(0, MAX_ARTICLE_CHARACTERS) }]
      : [];
  });
}

/** Whether a stored source is a statute's official text: a law's title or planalto's site. */
export function isStatuteSource({ title, url }: { title: string; url: string | null }): boolean {
  const host = url ? URL.parse(url)?.hostname : null;
  return STATUTE_TITLE.test(title.trim()) || (host ? STATUTE_HOSTS.has(host) : false);
}

/** A short name for citations: the title up to its first comma ("Lei nº 8.112"). */
export function toStatuteShortName(title: string): string {
  return title.split(",")[0]?.trim() || title.trim();
}
