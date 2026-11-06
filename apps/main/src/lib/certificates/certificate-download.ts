/** Characters that file systems refuse in a name, and control characters. */
const UNSAFE_FILE_CHARACTERS = /[\p{Cc}"*/:<>?\\|]/gu;
const NON_ASCII = /[^ -~]/gu;
const COMBINING_MARKS = /\p{M}/gu;
/** File systems cap a name at 255 bytes; this leaves room for ".png" and a browser's " (1)". */
const MAX_NAME_BYTES = 240;
const HEX_RADIX = 16;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const utf8 = new TextEncoder();

function truncateToBytes(text: string): string {
  let kept = "";
  let bytes = 0;

  for (const { segment } of graphemes.segment(text)) {
    bytes += utf8.encode(segment).length;

    if (bytes > MAX_NAME_BYTES) {
      break;
    }

    kept += segment;
  }

  return kept;
}

function toFileName(parts: readonly (string | null)[]): string {
  const name = parts
    .map((part) => part?.replaceAll(UNSAFE_FILE_CHARACTERS, " ").replaceAll(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join(" - ");

  return `${truncateToBytes(name).trim()}.png`;
}

function toAscii(text: string | null): string | null {
  return (
    text
      ?.normalize("NFKD")
      .replaceAll(/\s+/gu, " ")
      .replaceAll(COMBINING_MARKS, "")
      .replaceAll(NON_ASCII, "") ?? null
  );
}

/** RFC 5987 leaves these out of a `filename*` value, and `encodeURIComponent` keeps them. */
function encodeExtendedValue(value: string): string {
  return encodeURIComponent(value).replaceAll(
    /['()*]/gu,
    (char) => `%${char.codePointAt(0)?.toString(HEX_RADIX).toUpperCase()}`,
  );
}

/**
 * "{Name} - {Title} - Zoonk.png". The `filename*` form keeps any script; the plain `filename` is an
 * ASCII copy for the few clients that read only it.
 */
export function getCertificateDownloadDisposition({
  name,
  title,
}: {
  name: string | null;
  title: string;
}): string {
  const parts = [name, title, "Zoonk"];
  const asciiName = toFileName(parts.map((part) => toAscii(part)));

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeExtendedValue(toFileName(parts))}`;
}
