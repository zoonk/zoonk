import "server-only";
import { learnMessages, learnSiteMessages } from "@zoonk/learn/messages";
import { playerMessages } from "@zoonk/player/messages";
import { isJsonObject } from "@zoonk/utils/json";
import { mergeMessages } from "./merge-messages";

type Messages = Record<string, unknown>;

/**
 * Which catalogs a part of the app sends to the browser. Every page gets main's own messages and
 * learn's site messages (votes and the feedback form are everywhere, and goals start from public
 * pages); learn screens add the learn
 * catalog, and the lesson player adds the player's. Server components read every catalog through
 * `request.ts` either way, so this only decides what client components can use.
 */
export type ClientMessagesScope = "learn" | "player" | "site";

async function appMessages(locale: string): Promise<Messages> {
  const translations: unknown = await import(`../../messages/${locale}.po`);

  if (!isJsonObject(translations) || !isJsonObject(translations.default)) {
    throw new Error(`Could not load app messages for locale "${locale}".`);
  }

  return translations.default;
}

async function loadMessages({
  locale,
  scope,
}: {
  locale: string;
  scope: ClientMessagesScope;
}): Promise<Messages> {
  if (scope === "player") {
    const [player, learn, app] = await Promise.all([
      playerMessages(locale),
      learnMessages(locale),
      appMessages(locale),
    ]);

    return mergeMessages(player, learn, app);
  }

  if (scope === "learn") {
    const [learn, app] = await Promise.all([learnMessages(locale), appMessages(locale)]);
    return mergeMessages(learn, app);
  }

  const [site, app] = await Promise.all([learnSiteMessages(locale), appMessages(locale)]);
  return mergeMessages(site, app);
}

/**
 * A production build's catalogs never change, so each locale's and scope's merge is made once per
 * server instead of on every render: merging walks thousands of keys, and every page renders it
 * two or three times (the server's messages, then each scope's provider), prefetches included. In
 * development extraction rewrites the catalogs as code changes, so each render merges them again.
 */
const merged = new Map<string, Promise<Messages>>();

/** The messages client components need in a scope, so pages don't ship every catalog. */
export function getClientMessages(input: {
  locale: string;
  scope: ClientMessagesScope;
}): Promise<Messages> {
  if (process.env.NODE_ENV !== "production") {
    return loadMessages(input);
  }

  const key = `${input.scope}:${input.locale}`;
  const cached = merged.get(key);

  if (cached) {
    return cached;
  }

  const loading = loadMessages(input);
  merged.set(key, loading);
  // A failed load isn't kept: the next render tries again.
  loading.catch(() => merged.delete(key));
  return loading;
}

/** Every catalog, for server components. App messages win a key collision unless still untranslated. */
export function getAllMessages(locale: string): Promise<Messages> {
  return getClientMessages({ locale, scope: "player" });
}
