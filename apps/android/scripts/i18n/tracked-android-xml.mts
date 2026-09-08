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
 * Treat stale values as missing so Eloqnt's existing lint and translate commands handle them.
 * Fingerprints travel with each locale's XML; CI needs neither Git history nor model credentials.
 */
export function createTrackedAndroidXmlCodec({
  readSource,
  sourceLocale = "en",
}: {
  readSource: () => string;
  sourceLocale?: string;
}) {
  return defineCodec(() => ({
    decode(content, { locale }) {
      const messages = decodeXml(stripFingerprints(content));

      if (locale === sourceLocale) {
        return messages;
      }

      const fingerprints = readFingerprints(content);
      const sources = new Map(decodeXml(readSource()).map((message) => [message.id, message]));

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
      // Source XML owns printf types, XLIFF metadata, and resource kinds.
      const codec = createAndroidXmlCodec();
      const sourceXml = readSource();
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
