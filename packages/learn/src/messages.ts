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
 * apps offer votes and the feedback form everywhere, why a goal couldn't start
 * (`useExtracted("goalErrors")`), since goals start from public pages too, the plan's phase names
 * (`useExtracted("planPhases")`), since a shared plan's public page names them, and the belt names
 * (`useExtracted("belts")`), since a signed-in learner's avatar shows theirs on public pages too.
 * Apps ship these everywhere and the rest of the catalog only where learn screens render.
 */
export async function learnSiteMessages(locale: string): Promise<LearnMessages> {
  const { belts, feedback, goalErrors, planPhases } = await learnMessages(locale);
  return { belts, feedback, goalErrors, planPhases };
}
