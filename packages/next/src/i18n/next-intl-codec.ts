import { defineCodec } from "next-intl/extractor";
import POParser, { type Entry } from "po-parser";

type ExtractedMessage = {
  id: string;
  message: string;
  description?: string;
  references?: Entry["references"];
  /** Allows for additional properties like .po flags to be read and later written. */
  [key: string]: unknown;
};

function setNestedProperty(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split(".").filter(Boolean);
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;

    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    // After the check above, current[key] is guaranteed to be an object
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- needed for TypeScript to narrow index access
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys.at(-1);

  if (lastKey) {
    current[lastKey] = value;
  }
}

function getSortedMessages(messages: ExtractedMessage[]): ExtractedMessage[] {
  return messages.toSorted((messageA, messageB) => {
    const pathA = messageA.references?.[0]?.path ?? "";
    const pathB = messageB.references?.[0]?.path ?? "";

    if (pathA === pathB) {
      return localeCompare(messageA.id, messageB.id);
    }
    return localeCompare(pathA, pathB);
  });
}

function localeCompare(a: string, b: string) {
  return a.localeCompare(b, "en");
}

function getUniqueReferences(references: Entry["references"]): Array<{ path: string }> | undefined {
  if (!references || references.length === 0) {
    return;
  }

  const uniquePaths = [...new Set(references.map((ref) => ref.path))];
  return uniquePaths.map((path) => ({ path }));
}

export default defineCodec(() => {
  const DefaultMetadata = {
    "Content-Transfer-Encoding": "8bit",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Generator": "next-intl",
  };

  const metadataByLocale = new Map<string, Record<string, string>>();

  return {
    decode(content, context) {
      const catalog = POParser.parse(content);
      if (catalog.meta) {
        metadataByLocale.set(context.locale, catalog.meta);
      }
      const messages = catalog.messages ?? [];

      return messages.map((msg) => {
        const { extractedComments, msgctxt, msgid, msgstr, ...rest } = msg;

        // Necessary to restore the ID
        if (!msgctxt) {
          throw new Error("msgctxt is required");
        }

        if (extractedComments && extractedComments.length > 1) {
          throw new Error(
            `Multiple extracted comments are not supported. Found ${extractedComments.length} comments for msgid "${msgid}".`,
          );
        }

        return {
          ...rest,
          id: msgctxt,
          message: msgstr,
          ...(extractedComments &&
            extractedComments.length > 0 && {
              description: extractedComments[0],
            }),
        };
      });
    },

    encode(messages, context) {
      const encodedMessages = getSortedMessages(messages).map((msg) => {
        const sourceMessage = context.sourceMessagesById.get(msg.id)?.message;
        if (!sourceMessage) {
          throw new Error(
            `Source message not found for id "${msg.id}" in locale "${context.locale}".`,
          );
        }

        const { description, id, message, references, ...rest } = msg;
        return {
          ...(description && { extractedComments: [description] }),
          ...rest,
          msgctxt: id,
          msgid: sourceMessage,
          msgstr: message,
          references: getUniqueReferences(references),
        };
      });

      return POParser.serialize({
        messages: encodedMessages,
        meta: {
          Language: context.locale,
          ...DefaultMetadata,
          ...metadataByLocale.get(context.locale),
        },
      });
    },

    toJSONString(source, context) {
      const parsed = this.decode(source, context);
      const messagesObject = {};
      for (const message of parsed) {
        setNestedProperty(messagesObject, message.id, message.message);
      }
      return JSON.stringify(messagesObject);
    },
  };
});
