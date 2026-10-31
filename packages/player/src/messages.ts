import { isJsonObject } from "@zoonk/utils/json";

type PlayerMessages = Record<string, unknown>;
type PlayerMessagesModule = { default: PlayerMessages };

function isPlayerMessagesModule(value: unknown): value is PlayerMessagesModule {
  return isJsonObject(value) && isJsonObject(value.default);
}

/** Client modules needing a static catalog must import `@zoonk/player/messages/<locale>.po`. */
export async function playerMessages(locale: string): Promise<PlayerMessages> {
  const translations: unknown = await import(`../messages/${locale}.po`);

  if (!isPlayerMessagesModule(translations)) {
    throw new Error(`Could not load player messages for locale "${locale}".`);
  }

  return translations.default;
}
