import { isJsonObject } from "@zoonk/utils/json";

type PlayerMessages = Record<string, unknown>;
type PlayerMessagesModule = { default: PlayerMessages };

/**
 * Verifies that next-intl transformed a .po catalog into the module shape used by apps.
 * Throwing here gives consumers a clear package-level failure instead of returning an
 * invalid catalog from a missing or misconfigured locale file.
 */
function isPlayerMessagesModule(value: unknown): value is PlayerMessagesModule {
  return isJsonObject(value) && isJsonObject(value.default);
}

/**
 * Loads the player-owned translation catalog for an app locale.
 * Apps should call this instead of importing package message files directly so
 * the player package keeps ownership of where its extracted catalogs live.
 */
export async function playerMessages(locale: string): Promise<PlayerMessages> {
  const translations: unknown = await import(`../messages/${locale}.po`);

  if (!isPlayerMessagesModule(translations)) {
    throw new Error(`Could not load player messages for locale "${locale}".`);
  }

  return translations.default;
}
