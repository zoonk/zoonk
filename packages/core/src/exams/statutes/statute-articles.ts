import { splitLawArticles } from "../../library/sources/law-articles";

const MIN_ARTICLE_CHARACTERS = 40;
const MAX_ARTICLE_CHARACTERS = 1500;

const STATUTE_TITLE = /^(?:lei|decreto|constitui[çc][ãa]o|c[óo]digo|emenda constitucional)\b/iu;
const STATUTE_HOSTS = new Set(["planalto.gov.br", "www.planalto.gov.br"]);

export type StatuteArticleText = { reference: string; text: string };

export function splitStatuteArticles(text: string): StatuteArticleText[] {
  return splitLawArticles(text).flatMap((article) => {
    const body = article.body.replaceAll(/\s+/gu, " ");

    return body.length >= MIN_ARTICLE_CHARACTERS
      ? [{ reference: article.heading, text: body.slice(0, MAX_ARTICLE_CHARACTERS) }]
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

export function formatStatuteSource({
  articles,
  law,
}: {
  articles: readonly StatuteArticleText[];
  law: { shortName: string; title: string };
}): string {
  return [
    `${law.title} (${law.shortName})`,
    ...articles.map(({ reference, text }) => `${reference}: ${text}`),
  ].join("\n\n");
}
