import { defineCodec } from "next-intl/extractor";
import POParser, { type Entry } from "po-parser";

const BUILT_IN_SOURCE_KEY = "X-Crowdin-SourceKey";
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// oxlint-disable-next-line sort-keys -- Preserve the conventional gettext header order.
const DEFAULT_METADATA = {
  "Content-Type": "text/plain; charset=utf-8",
  "Content-Transfer-Encoding": "8bit",
  "X-Generator": "next-intl",
};

type Codec = ReturnType<ReturnType<typeof defineCodec>>;
type DecodeContext = Parameters<Codec["decode"]>[1];
type EncodeContext = Parameters<Codec["encode"]>[1];
type ExtractedMessage = ReturnType<Codec["decode"]>[number];

/**
 * Identifies catalogs written by next-intl's built-in PO codec so the first
 * extraction can migrate their IDs without losing existing translations.
 */
function usesBuiltInCodec(metadata: Record<string, string> | undefined) {
  return metadata?.[BUILT_IN_SOURCE_KEY] === "msgstr";
}

/**
 * Removes metadata that told Crowdin to treat msgstr as the source key. This
 * codec writes the source message to msgid, so keeping that header would make
 * external PO tools read the translated value as the source text.
 */
function getRetainedMetadata(metadata: Record<string, string> | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([key]) => key !== BUILT_IN_SOURCE_KEY),
  );
}

/**
 * Restores the runtime ID from either the new codec shape or the built-in PO
 * shape used before this migration. Built-in catalogs use msgctxt as a
 * namespace, while this codec stores the complete generated ID there.
 */
function getMessageId({ entry, isBuiltInCatalog }: { entry: Entry; isBuiltInCatalog: boolean }) {
  if (isBuiltInCatalog) {
    return entry.msgctxt ? `${entry.msgctxt}.${entry.msgid}` : entry.msgid;
  }

  if (!entry.msgctxt) {
    throw new Error(`msgctxt is required for msgid "${entry.msgid}".`);
  }

  return entry.msgctxt;
}

/**
 * Converts a PO entry into next-intl's extractor shape while retaining flags,
 * comments, and references needed when the catalog is written again.
 */
function decodeEntry({ entry, isBuiltInCatalog }: { entry: Entry; isBuiltInCatalog: boolean }) {
  const {
    extractedComments,
    msgctxt: _msgctxt,
    msgid: _msgid,
    msgstr,
    references,
    ...rest
  } = entry;

  return {
    ...rest,
    description: extractedComments ?? [],
    id: getMessageId({ entry, isBuiltInCatalog }),
    message: msgstr,
    references: references ?? [],
  } satisfies ExtractedMessage;
}

/**
 * Sorts entries by their first source reference so extraction produces stable
 * catalogs that follow the same order as next-intl's built-in codecs.
 */
function compareMessages({
  messageA,
  messageB,
}: {
  messageA: ExtractedMessage;
  messageB: ExtractedMessage;
}) {
  const referenceA = messageA.references[0];
  const referenceB = messageB.references[0];

  if (!referenceA || !referenceB) {
    return 0;
  }

  const pathComparison = referenceA.path.localeCompare(referenceB.path, "en");
  return pathComparison || (referenceA.line ?? 0) - (referenceB.line ?? 0);
}

/**
 * Keeps one path-only reference per source file because line numbers change
 * frequently and create noisy catalog diffs.
 */
function getPathOnlyReferences(
  references: ExtractedMessage["references"],
): NonNullable<Entry["references"]> {
  return [...new Set(references.map((reference) => reference.path))].map((path) => ({ path }));
}

/**
 * Writes source text to msgid while retaining the generated runtime ID in
 * msgctxt and the existing locale value in msgstr.
 */
function encodeMessage({
  context,
  message,
}: {
  context: EncodeContext;
  message: ExtractedMessage;
}): Entry {
  const sourceMessage = context.sourceMessagesById.get(message.id)?.message;

  if (sourceMessage === undefined) {
    throw new Error(
      `Source message not found for id "${message.id}" in locale "${context.locale}".`,
    );
  }

  const { description, id, message: translation, references, ...rest } = message;
  const pathOnlyReferences = getPathOnlyReferences(references);

  return {
    ...rest,
    ...(description.length > 0 && { extractedComments: description }),
    ...(pathOnlyReferences.length > 0 && { references: pathOnlyReferences }),
    msgctxt: id,
    msgid: sourceMessage,
    msgstr: translation,
  };
}

/**
 * Checks message ID segments before they become object keys so a catalog
 * cannot modify an object's prototype when next-intl loads it as JSON.
 */
function assertSafeKey(key: string) {
  if (FORBIDDEN_OBJECT_KEYS.has(key)) {
    throw new Error(`Invalid message id segment: ${key}`);
  }
}

/** Checks whether an existing message branch can receive another nested key. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Adds one dotted runtime ID to the local catalog object. Keeping the mutation
 * inside this builder avoids repeatedly copying the whole catalog while still
 * preventing unsafe object keys.
 */
function setNestedProperty({
  index = 0,
  keyPath,
  object,
  value,
}: {
  index?: number;
  keyPath: string[];
  object: Record<string, unknown>;
  value: string;
}) {
  const key = keyPath[index];

  if (!key) {
    return;
  }

  assertSafeKey(key);

  if (index === keyPath.length - 1) {
    object[key] = value;
    return;
  }

  const existingValue = object[key];
  const nestedObject = isRecord(existingValue) ? existingValue : {};

  object[key] = nestedObject;
  setNestedProperty({ index: index + 1, keyPath, object: nestedObject, value });
}

/**
 * Builds the nested JSON catalog so each generated ID remains the runtime
 * lookup key even though PO tools display its source message as msgid.
 */
function getMessagesObject(messages: ExtractedMessage[]): Record<string, unknown> {
  const messagesObject: Record<string, unknown> = {};

  for (const message of messages) {
    setNestedProperty({
      keyPath: message.id.split("."),
      object: messagesObject,
      value: message.message,
    });
  }

  return messagesObject;
}

/**
 * Creates an isolated codec instance so metadata is retained per locale while
 * next-intl reads and writes a set of catalogs during one extraction run.
 */
function createPoCodec(): Codec {
  const metadataByLocale = new Map<string, Record<string, string>>();

  /** Reads both legacy built-in catalogs and catalogs already written by this codec. */
  function decode(content: string, context: DecodeContext) {
    const catalog = POParser.parse(content);
    const isBuiltInCatalog = usesBuiltInCodec(catalog.meta);

    metadataByLocale.set(context.locale, getRetainedMetadata(catalog.meta));

    return (catalog.messages ?? []).map((entry) => decodeEntry({ entry, isBuiltInCatalog }));
  }

  /** Writes the standard PO source/translation shape while preserving runtime IDs. */
  function encode(messages: ExtractedMessage[], context: EncodeContext) {
    const sortedMessages = messages.toSorted((messageA, messageB) =>
      compareMessages({ messageA, messageB }),
    );

    return POParser.serialize({
      messages: sortedMessages.map((message) => encodeMessage({ context, message })),
      meta: {
        Language: context.locale,
        ...DEFAULT_METADATA,
        ...metadataByLocale.get(context.locale),
      },
    });
  }

  /** Converts PO content into the nested JSON shape consumed by next-intl at runtime. */
  function toJSONString(content: string, context: DecodeContext) {
    return JSON.stringify(getMessagesObject(decode(content, context)));
  }

  return { decode, encode, toJSONString };
}

export default defineCodec(createPoCodec);
