/**
 * Shared player browser tests assert the package's visible behavior, not
 * next-intl's runtime. Returning the extracted literal keeps those tests
 * stable across apps and locale providers.
 */
export function useExtracted() {
  return (value: string) => value;
}
