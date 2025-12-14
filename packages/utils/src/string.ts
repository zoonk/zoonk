const ACCENTS_REGEX = /[\u0300-\u036f]/g;

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(ACCENTS_REGEX, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}
