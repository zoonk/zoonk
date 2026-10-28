import { getBaseLanguage } from "@zoonk/utils/languages";

export function getAlphabetIdentityKey(targetLanguage: string): string {
  return `alphabet:${getBaseLanguage(targetLanguage)}`;
}
