import { createHash } from "node:crypto";
import type createAndroidXmlCodec from "@eloqnt/format-android-xml";

export type AndroidMessage = ReturnType<ReturnType<typeof createAndroidXmlCodec>["decode"]>[number];

const HEADER = /<!-- eloqnt-fingerprints-v1\n(?<data>[\s\S]*?)\n-->\n?/u;

function isFingerprints(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

export function readFingerprints(content: string): Record<string, string> {
  const header = HEADER.exec(content)?.groups?.data;

  if (!header) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(header);
    return isFingerprints(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function stripFingerprints(content: string) {
  return content.replace(HEADER, "");
}

function messageContent(message: AndroidMessage) {
  return [message.message, message.printf ?? null, message.xliff ?? null, message.cdata ?? false];
}

/** Android printf types are metadata: %1$s and %1$d both decode to the ICU token {arg1}. */
export function fingerprint({
  source,
  target,
  locale,
}: {
  source: AndroidMessage;
  target: AndroidMessage;
  locale: string;
}) {
  const content = JSON.stringify([
    1,
    locale,
    source.id,
    messageContent(source),
    messageContent(target),
  ]);

  return createHash("sha256").update(content).digest("hex");
}

export function addFingerprints({
  xml,
  fingerprints,
}: {
  xml: string;
  fingerprints: Record<string, string>;
}) {
  const sorted = Object.fromEntries(
    Object.keys(fingerprints)
      .toSorted()
      .map((id) => [id, fingerprints[id]]),
  );

  const header = `<!-- eloqnt-fingerprints-v1\n${JSON.stringify(sorted, null, 2)}\n-->\n`;
  return xml.replace("<resources", `${header}<resources`);
}
