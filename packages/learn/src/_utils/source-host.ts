export function getSourceHost(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : url;
}
