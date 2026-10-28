import { defineCodec } from "@eloqnt/cli";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { completeMessages } from "./complete-messages.mts";
import {
  addFingerprints,
  fingerprint,
  readFingerprints,
  stripFingerprints,
} from "./fingerprints.mts";
import { translationTemplate } from "./translation-template.mts";

function decodeXml(content: string) {
  return createAndroidXmlCodec().decode(content);
}

/**
 * Decodes stale translations as missing, so Eloqnt's lint and translate commands handle them.
 * `readSources` returns every catalog's source XML because Eloqnt doesn't tell a codec which file it reads.
 */
export function createTrackedAndroidXmlCodec({
  readSources,
  sourceLocale = "en",
}: {
  readSources: () => string[];
  sourceLocale?: string;
}) {
  return defineCodec(() => ({
    decode(content, { locale }) {
      const messages = decodeXml(stripFingerprints(content));

      if (locale === sourceLocale) {
        return messages;
      }

      const fingerprints = readFingerprints(content);

      const sources = new Map(
        readSources()
          .flatMap((xml) => decodeXml(xml))
          .map((message) => [message.id, message]),
      );

      function markStale(target: (typeof messages)[number]) {
        const source = sources.get(target.id);

        if (!source || fingerprints[target.id] === fingerprint({ locale, source, target })) {
          return target;
        }

        return { ...target, message: "" };
      }

      return messages.map((message) => markStale(message));
    },
    encode(messages, { locale, sourceMessagesById }) {
      // The catalog's source XML owns printf types, XLIFF metadata, resource kinds, and comments.
      const codec = createAndroidXmlCodec();
      const [sourceId] = sourceMessagesById.keys();

      const sourceXml =
        readSources().find((xml) => decodeXml(xml).some((message) => message.id === sourceId)) ??
        "<resources />";

      codec.decode(locale === sourceLocale ? sourceXml : translationTemplate(sourceXml));
      const complete = completeMessages({ messages, sources: sourceMessagesById });
      const xml = codec.encode(complete, { sourceMessagesById });

      if (locale === sourceLocale) {
        return xml;
      }

      function fingerprintEntry(target: (typeof messages)[number]): [string, string][] {
        const source = sourceMessagesById.get(target.id);
        return source ? [[target.id, fingerprint({ locale, source, target })]] : [];
      }

      const fingerprints = Object.fromEntries(
        decodeXml(xml).flatMap((target) => fingerprintEntry(target)),
      );

      return addFingerprints({ fingerprints, xml });
    },
  }))();
}
