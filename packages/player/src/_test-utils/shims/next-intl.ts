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
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*(?:\{\w+\}[^{}]*)*)\}\s*other\s*\{([^{}]*(?:\{\w+\}[^{}]*)*)\}\}/gu,
    (token, key: string, one: string, other: string) => {
      const count = Number(values[key]);

      if (!Number.isFinite(count)) {
        return token;
      }

      return (count === 1 ? one : other).replaceAll("#", String(count));
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
  const withPluralBlocks = formatPluralBlocks({ value, values });

  return withPluralBlocks.replaceAll(/\{(\w+)\}/gu, (token, key: string) =>
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
