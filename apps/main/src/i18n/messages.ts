import "server-only";
import { learnMessages, learnSiteMessages } from "@zoonk/learn/messages";
import { playerMessages } from "@zoonk/player/messages";
import { isJsonObject } from "@zoonk/utils/json";
import { mergeMessages } from "./merge-messages";

type Messages = Record<string, unknown>;

async function appMessages(locale: string): Promise<Messages> {
  const translations: unknown = await import(`../../messages/${locale}.po`);

  if (!isJsonObject(translations) || !isJsonObject(translations.default)) {
    throw new Error(`Could not load app messages for locale "${locale}".`);
  }

  return translations.default;
}

async function loadAllMessages(locale: string): Promise<Messages> {
  const [player, learn, app] = await Promise.all([
    playerMessages(locale),
    learnMessages(locale),
    appMessages(locale),
  ]);

  return mergeMessages(player, learn, app);
}

async function loadSiteMessages(locale: string): Promise<Messages> {
  const [site, app] = await Promise.all([learnSiteMessages(locale), appMessages(locale)]);
  return mergeMessages(site, app);
}

/**
 * A production build's catalogs never change, so each locale's merge is made once per server
 * instead of on every render: merging walks thousands of keys, and every page renders it, its
 * prefetches included. In development extraction rewrites the catalogs as code changes, so each
 * render merges them again.
 */
const merged = new Map<string, Promise<Messages>>();

function mergeOnce(key: string, load: () => Promise<Messages>): Promise<Messages> {
  if (process.env.NODE_ENV !== "production") {
    return load();
  }

  const cached = merged.get(key);

  if (cached) {
    return cached;
  }

  const loading = load();
  merged.set(key, loading);
  // A failed load isn't kept: the next render tries again.
  loading.catch(() => merged.delete(key));
  return loading;
}

/** Every catalog, for server components. App messages win a key collision unless still untranslated. */
export function getAllMessages(locale: string): Promise<Messages> {
  return mergeOnce(`all:${locale}`, () => loadAllMessages(locale));
}

/**
 * What every page's client components can use: main's own messages and learn's site messages
 * (votes and the feedback form are everywhere, and goals start from public pages).
 */
export function getSiteMessages(locale: string): Promise<Messages> {
  return mergeOnce(`site:${locale}`, () => loadSiteMessages(locale));
}
