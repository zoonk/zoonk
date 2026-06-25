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

export function useExtracted() {
  return (value: string, values?: Record<string, number | string>) =>
    formatExtractedMessage({ value, values });
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
