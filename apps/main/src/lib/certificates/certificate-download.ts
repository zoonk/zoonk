/** Characters that file systems refuse in a name, and control characters. */
const UNSAFE_FILE_CHARACTERS = /[\u0000-\u001F\u007F"*/:<>?\\|]/gu;
const NON_ASCII = /[^ -~]/gu;
const COMBINING_MARKS = /\p{M}/gu;
const MAX_NAME_LENGTH = 180;

function toFileName(parts: readonly (string | null)[]): string {
  const name = parts
    .map((part) => part?.replaceAll(UNSAFE_FILE_CHARACTERS, " ").replaceAll(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join(" - ");

  return `${Array.from(name).slice(0, MAX_NAME_LENGTH).join("")}.png`;
}

function toAscii(text: string | null): string | null {
  return text?.normalize("NFKD").replaceAll(COMBINING_MARKS, "").replaceAll(NON_ASCII, "") ?? null;
}

/** RFC 5987 leaves these out of a `filename*` value, and `encodeURIComponent` keeps them. */
function encodeExtendedValue(value: string): string {
  return encodeURIComponent(value).replaceAll(
    /['()*]/gu,
    (char) => `%${char.codePointAt(0)?.toString(16).toUpperCase()}`,
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
