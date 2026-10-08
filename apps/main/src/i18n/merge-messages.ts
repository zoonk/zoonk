import { isJsonObject } from "@zoonk/utils/json";

type Messages = Record<string, unknown>;

/**
 * An empty message is one that extraction added but nobody has translated yet, so it must not
 * blank a translation that an earlier catalog already has for the same key.
 */
function mergeMessage(earlier: unknown, later: unknown): unknown {
  if (later === undefined || later === "") {
    return earlier ?? later;
  }

  if (isJsonObject(earlier) && isJsonObject(later)) {
    return mergeTwo(earlier, later);
  }

  return later;
}

function mergeTwo(earlier: Messages, later: Messages): Messages {
  const keys = new Set([...Object.keys(earlier), ...Object.keys(later)]);
  return Object.fromEntries([...keys].map((key) => [key, mergeMessage(earlier[key], later[key])]));
}

/**
 * Merges message catalogs in order, so a later catalog wins a key collision (app messages override
 * the packages'), namespaces merge key by key, and an untranslated (empty) message never replaces
 * a translated one.
 */
export function mergeMessages(...catalogs: Messages[]): Messages {
  return catalogs.reduce<Messages>((merged, catalog) => mergeTwo(merged, catalog), {});
}
