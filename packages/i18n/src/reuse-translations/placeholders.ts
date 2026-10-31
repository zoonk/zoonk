import {
  type MessageFormatElement,
  isArgumentElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isTimeElement,
  parse,
} from "@formatjs/icu-messageformat-parser";

type Placeholder = { name: string; format: string; start: number; end: number };

type Part = { text: string } | Placeholder;

export type English = {
  /** The English with each placeholder replaced by its position and format, so web, Apple, and Android copies compare equal. */
  key: string;
  /** Placeholder names in order of first appearance. */
  names: string[];
  placeholders: Pick<Placeholder, "name" | "format">[];
  words: number;
};

/** Web catalogs hold ICU, but Apple and Android hold a string without printf arguments as plain text, where ICU quotes would show. */
const ICU_QUOTE = /'[{}']/u;

/** A plain `{name}` formats as "}", `{count, number}` as ",number}". */
function placeholderFormat({ text, name }: { text: string; name: string }) {
  return text.slice(text.indexOf(name) + name.length).replaceAll(/\s/gu, "");
}

function toPart({
  element,
  message,
}: {
  element: MessageFormatElement;
  message: string;
}): Part | undefined {
  if (isLiteralElement(element)) {
    return { text: element.value };
  }

  const isPlaceholder =
    isArgumentElement(element) ||
    isNumberElement(element) ||
    isDateElement(element) ||
    isTimeElement(element);

  if (!isPlaceholder || !element.location) {
    return undefined;
  }

  const start = element.location.start.offset;
  const end = element.location.end.offset;
  const name = element.value;
  return { end, format: placeholderFormat({ name, text: message.slice(start, end) }), name, start };
}

/** Tags stay literal text, as the Apple and Android codecs read them. Plurals and selects stay with Eloqnt. */
function parseParts(message: string): Part[] | undefined {
  if (ICU_QUOTE.test(message)) {
    return undefined;
  }

  try {
    const parts = parse(message, { captureLocation: true, ignoreTag: true }).map((element) =>
      toPart({ element, message }),
    );

    return parts.every((part) => part !== undefined) ? parts : undefined;
  } catch {
    return undefined;
  }
}

function placeholdersOf(parts: Part[]) {
  return parts.filter((part) => "name" in part);
}

function uniqueNames(placeholders: Placeholder[]) {
  return [...new Set(placeholders.map((entry) => entry.name))];
}

export function parseEnglish(english: string): English | undefined {
  const parts = parseParts(english);

  if (!parts) {
    return undefined;
  }

  const placeholders = placeholdersOf(parts);
  const names = uniqueNames(placeholders);

  const key = parts
    .map((part) =>
      "text" in part ? part.text : `\u{E000}${names.indexOf(part.name)}${part.format}\u{E001}`,
    )
    .join("");

  return {
    key,
    names,
    placeholders: placeholders.map(({ name, format }) => ({ format, name })),
    words: key.trim().split(/\s+/u).length,
  };
}

function renamePlaceholder({
  message,
  entry,
  name,
}: {
  message: string;
  entry: Placeholder;
  name: string;
}) {
  const text = message.slice(entry.start, entry.end);
  const nameStart = text.indexOf(entry.name);
  return `${text.slice(0, nameStart)}${name}${text.slice(nameStart + entry.name.length)}`;
}

/**
 * Renames a translation's placeholders from its English's names to another English's, matched by position. Undefined
 * when the translation is a plural or select, or its placeholders aren't exactly its English's, formats included.
 */
export function mapPlaceholders({
  translation,
  from,
  to,
}: {
  translation: string;
  from: English;
  to: English;
}): string | undefined {
  const parts = parseParts(translation);
  const placeholders = parts ? placeholdersOf(parts) : [];

  const isLikeEnglish =
    uniqueNames(placeholders).length === from.names.length &&
    placeholders.every((entry) =>
      from.placeholders.some(({ name, format }) => name === entry.name && format === entry.format),
    );

  if (!parts || !isLikeEnglish || from.names.length !== to.names.length) {
    return undefined;
  }

  const renamed = placeholders.map((entry) =>
    renamePlaceholder({
      entry,
      message: translation,
      name: to.names[from.names.indexOf(entry.name)] ?? "",
    }),
  );

  const gaps = [0, ...placeholders.map((entry) => entry.end)].map((start, index) =>
    translation.slice(start, placeholders[index]?.start),
  );

  return gaps.map((gap, index) => `${gap}${renamed[index] ?? ""}`).join("");
}
