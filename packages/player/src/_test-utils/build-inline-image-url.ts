function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Browser tests should not depend on remote image hosts staying available.
 * This helper creates a tiny inline SVG so step-image assertions exercise the
 * same `img` semantics without flaking on network errors or 404 fallbacks.
 */
export function buildInlineImageUrl({ label }: { label: string }): string {
  const safeLabel = escapeSvgText(label);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
    '<rect width="1024" height="1024" fill="#f4f4f5" />',
    '<text x="512" y="512" fill="#111827" font-family="Arial, sans-serif" font-size="36" text-anchor="middle">',
    safeLabel,
    "</text>",
    "</svg>",
  ].join("");

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
