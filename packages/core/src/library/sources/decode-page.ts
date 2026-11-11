/** Byte-order marks as their bytes read in windows-1252, the prescan's decoding. */
const BYTE_ORDER_MARKS = [
  { label: "utf8", marks: "ï»¿" },
  { label: "utf-16le", marks: "ÿþ" },
  { label: "utf-16be", marks: "þÿ" },
];

const META_CHARSET = /<meta\b[^>]*charset\s*=\s*["']?\s*(?<charset>[\w.:-]+)/iu;
const PRESCAN_BYTES = 1024;

/** A page that declares nothing is UTF-8, unless its bytes aren't: Planalto serves its laws that way. */
function decodeUndeclared(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function toDecoder(label: string | undefined): TextDecoder | null {
  try {
    return label ? new TextDecoder(label) : null;
  } catch {
    return null;
  }
}

/**
 * As a browser decodes a page: its byte-order mark, else the charset its response declares, else
 * the one an HTML page's `<meta>` declares in its first kilobyte, skipping a charset no decoder
 * knows, else as `decodeUndeclared` reads it. A `<meta>` declaring UTF-16 can't be right, since
 * the prescan read it as ASCII. Plain text only quotes a `<meta>`, so its own is never read.
 */
export function decodePage({
  bytes,
  charset,
  isHtml,
}: {
  bytes: Uint8Array;
  charset?: string | null;
  isHtml: boolean;
}): string {
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, PRESCAN_BYTES));
  const bom = BYTE_ORDER_MARKS.find(({ marks }) => head.startsWith(marks));
  const meta = isHtml ? META_CHARSET.exec(head)?.groups?.charset?.toLowerCase() : undefined;
  const labels = [bom?.label, charset ?? undefined, meta?.startsWith("utf-16") ? "utf8" : meta];
  const decoder = labels.map((label) => toDecoder(label)).find(Boolean);

  return decoder ? decoder.decode(bytes) : decodeUndeclared(bytes);
}
