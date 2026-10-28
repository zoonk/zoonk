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
 * Loads the learn-owned translation catalog for an app locale. Apps merge it with their own
 * catalog; a client module that needs one locale's catalog as a static script imports
 * `@zoonk/learn/messages/<locale>.po`, which the package exports.
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
 * (`useExtracted("belts")`) and the goal switcher's (`useExtracted("goalSwitcher")`), since a
 * signed-in learner's top bar shows their avatar and their goals on public pages too. The buddy's
 * names (`useExtracted("buddyNames")`) also name the command palette's actions on every page.
 * Apps ship these everywhere and the rest of the catalog only where learn screens render.
 */
export async function learnSiteMessages(locale: string): Promise<LearnMessages> {
  const { belts, buddyNames, feedback, goalErrors, goalSwitcher, planPhases } =
    await learnMessages(locale);

  return { belts, buddyNames, feedback, goalErrors, goalSwitcher, planPhases };
}
