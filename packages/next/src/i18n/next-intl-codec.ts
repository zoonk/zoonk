import { defineCodec } from "next-intl/extractor";
import POParser from "po-parser";

type ExtractedMessage = {
  id: string;
  message: string;
  description?: string;
  references?: Array<{ path: string }>;
  /** Allows for additional properties like .po flags to be read and later written. */
  [key: string]: unknown;
};

function setNestedProperty(
  obj: Record<string, unknown>,
  keyPath: string,
  value: unknown,
): void {
  const keys = keyPath.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) {
      continue;
    }

    if (
      !(key in current) ||
      typeof current[key] !== "object" ||
      current[key] === null
    ) {
      current[key] = {};
    }
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

export default defineCodec(() => {
  const DefaultMetadata = {
    "Content-Transfer-Encoding": "8bit",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Generator": "next-intl",
  };

  const metadataByLocale = new Map();

  return {
    decode(content, context) {
      const catalog = POParser.parse(content);
      if (catalog.meta) {
        metadataByLocale.set(context.locale, catalog.meta);
      }
      const messages =
        catalog.messages || ([] as NonNullable<typeof catalog.messages>);

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

        // Store the hashed ID in msgctxt so we can restore it during decode
        const { description, id, message, ...rest } = msg;
        return {
          ...(description && { extractedComments: [description] }),
          ...rest,
          msgctxt: id,
          msgid: sourceMessage,
          msgstr: message,
        };
      });

      return POParser.serialize({
        messages: encodedMessages,
        meta: {
          // biome-ignore lint/style/useNamingConvention: next-intl uses 'Language' as per PO file spec
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
