import { isJsonObject } from "@zoonk/utils/json";

type LearnMessages = Record<string, unknown>;
type LearnMessagesModule = { default: LearnMessages };

function isLearnMessagesModule(value: unknown): value is LearnMessagesModule {
  return isJsonObject(value) && isJsonObject(value.default);
}

export async function learnMessages(locale: string): Promise<LearnMessages> {
  const translations: unknown = await import(`../messages/${locale}.po`);

  if (!isLearnMessagesModule(translations)) {
    throw new Error(`Could not load learn messages for locale "${locale}".`);
  }

  return translations.default;
}

/**
 * Only the namespaces that render outside learn screens, such as on public pages and in the top
 * bar. Apps ship these everywhere and the rest of the catalog only where learn screens render.
 */
export async function learnSiteMessages(locale: string): Promise<LearnMessages> {
  const { belts, buddyNames, feedback, goalErrors, goalSwitcher, planPhases } =
    await learnMessages(locale);

  return { belts, buddyNames, feedback, goalErrors, goalSwitcher, planPhases };
}
