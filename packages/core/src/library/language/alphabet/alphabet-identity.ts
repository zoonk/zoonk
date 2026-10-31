/** One intro per writing system, so simplified (`zh`) and traditional (`zh-TW`) Chinese get their own. */
export function getAlphabetIdentityKey(targetLanguage: string): string {
  const { language, script } = new Intl.Locale(targetLanguage).maximize();
  return `alphabet:${language}-${script}`;
}
