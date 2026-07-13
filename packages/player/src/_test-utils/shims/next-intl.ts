import { Fragment, type ReactNode, createElement } from "react";

type MessageValue = number | string;
type RichMessageValue = MessageValue | ((children: ReactNode) => ReactNode);

/**
 * Shared player browser tests assert the package's visible behavior, not
 * next-intl's runtime. Formatting the ICU subset used by player messages keeps
 * visible behavior testable while still avoiding app-specific locale providers.
 */
function formatPluralBlocks({
  value,
  values,
}: {
  value: string;
  values: Record<string, number | string>;
}) {
  return value.replaceAll(
    /\{(?<key>\w+),\s*plural,\s*one\s*\{(?<one>[^{}]*(?:\{\w+\}[^{}]*)*)\}\s*other\s*\{(?<other>[^{}]*(?:\{\w+\}[^{}]*)*)\}\}/gu,
    (token, key: string, one: string, other: string) => {
      const count = Number(values[key]);

      if (!Number.isFinite(count)) {
        return token;
      }

      return (count === 1 ? one : other).replaceAll("#", String(count));
    },
  );
}

function formatSelectBlocks({
  value,
  values,
}: {
  value: string;
  values: Record<string, number | string>;
}) {
  return value.replaceAll(
    /\{(?<key>\w+),\s*select,\s*(?<options>(?:\w+\s*\{[^{}]*\}\s*)+)\}/gu,
    (token, key: string, options: string) => {
      const selected = String(values[key] ?? "");
      const parsedOptions = new Map<string, string>();

      for (const match of options.matchAll(/(?<option>\w+)\s*\{(?<label>[^{}]*)\}/gu)) {
        if (match.groups?.option && match.groups.label) {
          parsedOptions.set(match.groups.option, match.groups.label);
        }
      }

      return parsedOptions.get(selected) ?? parsedOptions.get("other") ?? token;
    },
  );
}

function formatExtractedMessage({
  value,
  values = {},
}: {
  value: string;
  values?: Record<string, number | string>;
}) {
  const withSelectBlocks = formatSelectBlocks({ value, values });
  const withPluralBlocks = formatPluralBlocks({ value: withSelectBlocks, values });

  return withPluralBlocks.replaceAll(/\{(?<key>\w+)\}/gu, (token, key: string) =>
    String(values[key] ?? token),
  );
}

/**
 * Rich messages combine normal ICU values with tag-rendering functions. The
 * browser-test shim separates those two roles so its existing ICU formatter
 * never stringifies a React function into the learner-facing message.
 */
function getPrimitiveMessageValues(values: Record<string, RichMessageValue>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, MessageValue] => typeof entry[1] !== "function",
    ),
  );
}

/**
 * A rich message part is either plain translated text or one tagged fragment.
 * Keeping this parser in the shared next-intl shim lets browser tests exercise
 * the same visible Kbd composition without requiring an app locale provider.
 */
function renderRichMessagePart({
  index,
  part,
  values,
}: {
  index: number;
  part: string;
  values: Record<string, RichMessageValue>;
}) {
  const match = /^<(?<tag>\w+)>(?<children>[^<]*)<\/\k<tag>>$/u.exec(part);
  const children = match?.groups?.children ?? "";
  const tag = match?.groups?.tag;
  const renderTag = tag ? values[tag] : null;

  if (typeof renderTag !== "function") {
    return part;
  }

  return createElement(Fragment, { key: index }, renderTag(children));
}

/**
 * Supports the inline rich tags used by player copy while preserving the
 * lightweight identity-style translation behavior expected by browser tests.
 */
function formatRichExtractedMessage({
  value,
  values,
}: {
  value: string;
  values: Record<string, RichMessageValue>;
}) {
  const formattedValue = formatExtractedMessage({
    value,
    values: getPrimitiveMessageValues(values),
  });

  return formattedValue
    .split(/(?<taggedPart><\w+>[^<]*<\/\w+>)/gu)
    .map((part, index) => renderRichMessagePart({ index, part, values }));
}

export function useExtracted() {
  const translate = (value: string, values?: Record<string, MessageValue>) =>
    formatExtractedMessage({ value, values });

  translate.rich = (value: string, values: Record<string, RichMessageValue>) =>
    formatRichExtractedMessage({ value, values });

  return translate;
}

export function useLocale() {
  return "en";
}

export function useFormatter() {
  const locale = useLocale();

  return {
    number: (value: number | bigint, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
}
