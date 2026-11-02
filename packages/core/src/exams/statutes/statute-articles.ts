const ARTICLE_START = /(?:^|\n)\s*(?<heading>Art\.\s*\d+[º°o]?(?:-[A-Z])?\.?)/gu;
const MIN_ARTICLE_CHARACTERS = 40;
const MAX_ARTICLE_CHARACTERS = 1500;

const STATUTE_TITLE = /^(?:lei|decreto|constitui[çc][ãa]o|c[óo]digo|emenda constitucional)\b/iu;
const STATUTE_HOSTS = new Set(["planalto.gov.br", "www.planalto.gov.br"]);

export type StatuteArticleText = { reference: string; text: string };

function toReference(heading: string): string {
  return heading.replaceAll(/\s+/gu, " ").replace(/\.$/u, "").trim();
}

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

export function isStatuteSource({ title, url }: { title: string; url: string | null }): boolean {
  const host = url ? URL.parse(url)?.hostname : null;
  return STATUTE_TITLE.test(title.trim()) || (host ? STATUTE_HOSTS.has(host) : false);
}

export function toStatuteShortName(title: string): string {
  return title.split(",")[0]?.trim() || title.trim();
}
