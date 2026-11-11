import { normalizeString } from "@zoonk/utils/string";

/** `country` is ISO 3166-1 alpha-2 and `language` the official text's. */
export type LawRequest = {
  country: string;
  language: string;
  name: string;
  officialDomains: readonly string[];
  searchTerms: readonly string[];
};

export function toLawKey(law: Pick<LawRequest, "country" | "language" | "name">) {
  return {
    country: law.country,
    language: law.language,
    name: normalizeString(law.name)
      .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  };
}

/** Lessons naming the same law at once join one run. */
export function getLawLookupToken(law: Pick<LawRequest, "country" | "language" | "name">): string {
  const { country, language, name } = toLawKey(law);
  return `law-source:${country}:${language}:${name}`;
}

/** A law can be looked up only with a country, the text's language and where it's published. */
export function canLookUpLaw(law: LawRequest): boolean {
  return (
    /^[A-Z]{2}$/u.test(law.country) &&
    /^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/iu.test(law.language) &&
    toLawKey(law).name.length > 0 &&
    law.officialDomains.length > 0
  );
}

/** `domains` are bare, as research plans keep them: "planalto.gov.br" takes "www4.planalto.gov.br". */
export function isOfficialSite({
  domains,
  url,
}: {
  domains: readonly string[];
  url: string | null;
}): boolean {
  const host = url
    ? URL.parse(url)
        ?.hostname.toLowerCase()
        .replace(/^www\./u, "")
    : null;

  return Boolean(host) && domains.some((domain) => host === domain || host?.endsWith(`.${domain}`));
}
