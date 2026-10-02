import { isJsonObject } from "@zoonk/utils/json";

type LearnMessages = Record<string, unknown>;
type LearnMessagesModule = { default: LearnMessages };

/**
 * Verifies that next-intl transformed a .po catalog into the module shape used by apps,
 * so a missing or misconfigured locale fails here instead of returning an invalid catalog.
 */
function isLearnMessagesModule(value: unknown): value is LearnMessagesModule {
  return isJsonObject(value) && isJsonObject(value.default);
}

/**
 * Loads the learn-owned translation catalog for an app locale. Apps merge it with
 * their own catalog instead of importing package message files directly.
 */
export async function learnMessages(locale: string): Promise<LearnMessages> {
  const translations: unknown = await import(`../messages/${locale}.po`);

  if (!isLearnMessagesModule(translations)) {
    throw new Error(`Could not load learn messages for locale "${locale}".`);
  }

  return translations.default;
}

/**
 * Only the messages every page needs: the feedback components' (`useExtracted("feedback")`), since
 * apps offer votes and the feedback form everywhere, and why a goal couldn't start
 * (`useExtracted("goalErrors")`), since goals start from public pages too. Apps ship these
 * everywhere and the rest of the catalog only where learn screens render.
 */
export async function learnSiteMessages(locale: string): Promise<LearnMessages> {
  const { feedback, goalErrors } = await learnMessages(locale);
  return { feedback, goalErrors };
}
