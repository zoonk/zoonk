/**
 * Shared player browser tests assert the package's visible behavior, not
 * next-intl's runtime. Formatting simple placeholders keeps visible behavior
 * testable while still avoiding app-specific locale providers.
 */
function formatExtractedMessage({
  value,
  values = {},
}: {
  value: string;
  values?: Record<string, number | string>;
}) {
  return value.replaceAll(/\{(\w+)\}/gu, (token, key: string) => String(values[key] ?? token));
}

export function useExtracted() {
  return (value: string, values?: Record<string, number | string>) =>
    formatExtractedMessage({ value, values });
}
