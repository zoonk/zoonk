function skeletonAttributes(attributes: string): boolean {
  const matches = attributes.matchAll(
    /(?<name>[^\s=/>]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<unquoted>[^\s>]+)))?/gu,
  );

  return [...matches].some(
    ({ groups }) =>
      groups?.name?.toLowerCase() === "data-slot" &&
      (groups.double ?? groups.single ?? groups.unquoted) === "skeleton",
  );
}

/** Flight payloads, comments and quoted attribute values are not rendered heading/skeleton tags. */
export function htmlMarkers(html: string) {
  const document = html.replaceAll(
    /<!--[\s\S]*?-->|<(?<inert>script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\k<inert>\s*>/giu,
    "",
  );

  const tags = [
    ...document.matchAll(
      /<(?<tag>[a-z][\w:-]*)(?=\s|\/?>)(?<attributes>(?:[^>"']|"[^"]*"|'[^']*')*)>/giu,
    ),
  ];

  return {
    headings: tags.filter(({ groups }) => groups?.tag?.toLowerCase() === "h1").length,
    skeletons: tags.filter(({ groups }) => skeletonAttributes(groups?.attributes ?? "")).length,
  };
}
