/** A source's site as a few words ("sisu.mec.gov.br"), for "according to …" links. */
export function getSourceHost(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : url;
}
