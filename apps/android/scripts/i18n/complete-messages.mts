import { type AndroidMessage } from "./fingerprints.mts";

function arrayName(message: AndroidMessage | undefined) {
  const segments = message?.segments;
  return Array.isArray(segments) && typeof segments[0] === "string" ? segments[0] : undefined;
}

/** A partial Android string-array would reindex its items; omit it until every item is translated. */
export function completeMessages({
  messages,
  sources,
}: {
  messages: AndroidMessage[];
  sources: Map<string, AndroidMessage>;
}) {
  const translated = new Map(
    messages.filter((message) => message.message.trim()).map((message) => [message.id, message]),
  );

  const missingArrays = new Set(
    [...sources.values()]
      .filter((source) => !translated.has(source.id))
      .map((message) => arrayName(message))
      .filter(Boolean),
  );

  return [...translated.values()].filter(
    (message) => !missingArrays.has(arrayName(sources.get(message.id))),
  );
}
