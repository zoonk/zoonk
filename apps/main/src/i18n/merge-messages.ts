import { isJsonObject } from "@zoonk/utils/json";

type Messages = Record<string, unknown>;

/** An empty message is one extraction added but nobody translated yet, so it must not blank an earlier translation. */
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

export function mergeMessages(...catalogs: Messages[]): Messages {
  return catalogs.reduce<Messages>((merged, catalog) => mergeTwo(merged, catalog), {});
}
