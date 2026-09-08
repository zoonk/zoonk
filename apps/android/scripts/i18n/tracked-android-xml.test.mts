import assert from "node:assert/strict";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { test } from "vitest";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE = `<resources>
  <string name="brand" translatable="false">Zoonk</string>
  <string name="title">Home</string>
  <string name="greeting">Hello, %1$s!</string>
  <plurals name="lessons">
    <item quantity="one">%1$d lesson</item>
    <item quantity="other">%1$d lessons</item>
  </plurals>
  <string-array name="levels"><item>Beginner</item><item>Advanced</item></string-array>
</resources>`;

const TARGET = `<resources>
  <string name="title">Inicio</string>
  <string name="greeting">¡Hola, %1$s!</string>
  <plurals name="lessons">
    <item quantity="one">%1$d lección</item>
    <item quantity="other">%1$d lecciones</item>
  </plurals>
  <string-array name="levels"><item>Principiante</item><item>Avanzado</item></string-array>
</resources>`;

const CONTEXT = { locale: "es", sourceLocale: "en" };

function sourceMessages(source: string) {
  return new Map(
    createAndroidXmlCodec()
      .decode(source)
      .map((message) => [message.id, message]),
  );
}

function translatedXml({ source = SOURCE, target = TARGET } = {}) {
  const codec = createTrackedAndroidXmlCodec({ readSource: () => source });

  return codec.encode(createAndroidXmlCodec().decode(target), {
    locale: "es",
    sourceMessagesById: sourceMessages(source),
  });
}

function readTranslations({ source = SOURCE, target = translatedXml(), locale = "es" } = {}) {
  return createTrackedAndroidXmlCodec({ readSource: () => source }).decode(target, {
    ...CONTEXT,
    locale,
  });
}

test("untracked translations require a translation run, even if their text is present", () => {
  assert.ok(readTranslations({ target: TARGET }).every((message) => message.message === ""));
});

test("a completed write survives a new codec instance and preserves native resource types", () => {
  const target = translatedXml();

  assert.deepEqual(
    readTranslations().map((message) => message.message),
    createAndroidXmlCodec()
      .decode(TARGET)
      .map((message) => message.message),
  );

  assert.match(target, /<plurals name="lessons">/u);
  assert.match(target, /<string-array name="levels">/u);
  assert.match(target, /%1\$s/u);
});

test("changing one source invalidates only that message", () => {
  const messages = readTranslations({ source: SOURCE.replace(">Home<", ">Your home<") });
  assert.equal(messages.find((message) => message.id === "title")?.message, "");

  assert.ok(
    messages.filter((message) => message.id !== "title").every((message) => message.message),
  );
});

test("a change to a printf type is stale even when its normalized ICU text is unchanged", () => {
  const messages = readTranslations({ source: SOURCE.replace("%1$s", "%1$d") });
  assert.equal(messages.find((message) => message.id === "greeting")?.message, "");
});

test("formatting-only source edits do not invalidate translations", () => {
  assert.ok(
    readTranslations({ source: SOURCE.replaceAll("  <", "    <") }).every(
      (message) => message.message,
    ),
  );
});

test("edited targets and targets copied into a different locale cannot reuse fingerprints", () => {
  assert.equal(
    readTranslations({ target: translatedXml().replace("Inicio", "Home") }).find(
      (message) => message.id === "title",
    )?.message,
    "",
  );

  assert.ok(readTranslations({ locale: "de" }).every((message) => message.message === ""));
});

test("partial writes do not certify untranslated messages", () => {
  const codec = createTrackedAndroidXmlCodec({ readSource: () => SOURCE });
  const pending = codec.decode(TARGET, CONTEXT);

  const updated = pending.map((message) =>
    message.id === "title" ? { ...message, message: "Inicio" } : message,
  );

  const target = codec.encode(updated, {
    locale: "es",
    sourceMessagesById: sourceMessages(SOURCE),
  });

  const messages = readTranslations({ target });
  assert.equal(messages.find((message) => message.id === "title")?.message, "Inicio");
  assert.equal(messages.filter((message) => message.message).length, 1);

  assert.ok(
    messages.filter((message) => message.id !== "title").every((message) => message.message === ""),
  );
});

test("partial arrays cannot shift translated items onto a different source index", () => {
  const codec = createTrackedAndroidXmlCodec({ readSource: () => SOURCE });

  const messages = codec
    .decode(TARGET, CONTEXT)
    .map((message) => (message.id === "levels.1" ? { ...message, message: "Avanzado" } : message));

  const target = codec.encode(messages, {
    locale: "es",
    sourceMessagesById: sourceMessages(SOURCE),
  });

  assert.ok(!readTranslations({ target }).some((message) => message.id.startsWith("levels.")));
});

test("retranslation can keep the same wording and still certify the updated source", () => {
  const source = SOURCE.replace(">Home<", ">Home!<");
  const target = translatedXml({ source });

  assert.equal(
    readTranslations({ source, target }).find((message) => message.id === "title")?.message,
    "Inicio",
  );
});

test("regeneration uses current source formatting metadata, not stale target metadata", () => {
  const source = SOURCE.replace("%1$s", "%1$d");
  const target = translatedXml({ source });
  assert.match(target, /¡Hola, %1\$d!/u);
  assert.ok(readTranslations({ source, target }).every((message) => message.message));
});

test("removed source IDs remain visible to Eloqnt's superfluous-key rule", () => {
  const source = SOURCE.replace('<string name="title">Home</string>', "");

  assert.equal(
    readTranslations({ source }).find((message) => message.id === "title")?.message,
    "Inicio",
  );
});

test("source resources are never treated as untranslated or stamped", () => {
  const codec = createTrackedAndroidXmlCodec({ readSource: () => SOURCE });
  const messages = codec.decode(SOURCE, { locale: "en", sourceLocale: "en" });
  assert.ok(messages.every((message) => message.message));
  assert.ok(!messages.some((message) => message.id === "brand"));

  assert.doesNotMatch(
    codec.encode(messages, { locale: "en", sourceMessagesById: sourceMessages(SOURCE) }),
    /eloqnt-fingerprints/u,
  );
});

test("non-translatable resources stay in the default locale, not in generated targets", () => {
  assert.doesNotMatch(translatedXml(), /name="brand"/u);
});

test("source-template filtering preserves XML escaping, CDATA, XLIFF, and formatting attributes", () => {
  const source = `<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="literal" formatted="false">A &amp; B %s</string>
    <string name="name">Hello, <xliff:g id="name">%1$s</xliff:g>!</string>
    <string name="markup"><![CDATA[<b>Welcome</b>]]></string>
  </resources>`;

  const target = translatedXml({ source, target: source });
  assert.match(target, /formatted="false"/u);
  assert.match(target, /A &amp; B/u);

  assert.deepEqual(
    readTranslations({ source, target }).map((message) => message.message),
    createAndroidXmlCodec()
      .decode(source)
      .map((message) => message.message),
  );
});
