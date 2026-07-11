import POParser from "po-parser";
import { describe, expect, it } from "vitest";
import createPoCodec from "./po-codec";

const legacyCatalog = `msgid ""
msgstr ""
"Language: pt\\n"
"Content-Type: text/plain; charset=utf-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Generator: next-intl\\n"
"X-Crowdin-SourceKey: msgstr\\n"

#: src/search.tsx
msgid "xmcVZ0"
msgstr "Pesquisar"
`;

describe("PO codec", () => {
  it("migrates legacy IDs without losing translations", () => {
    const codec = createPoCodec();
    const decodedMessages = codec.decode(legacyCatalog, { locale: "pt" });

    const sourceMessage = {
      description: [],
      id: "xmcVZ0",
      message: "Search",
      references: [{ path: "src/search.tsx" }],
    };

    const migratedCatalog = codec.encode(decodedMessages, {
      locale: "pt",
      sourceMessagesById: new Map([[sourceMessage.id, sourceMessage]]),
    });

    const parsedCatalog = POParser.parse(migratedCatalog);

    expect(
      parsedCatalog.messages?.map(({ msgctxt, msgid, msgstr, references }) => ({
        msgctxt,
        msgid,
        msgstr,
        references,
      })),
    ).toStrictEqual([
      {
        msgctxt: "xmcVZ0",
        msgid: "Search",
        msgstr: "Pesquisar",
        references: [{ path: "src/search.tsx" }],
      },
    ]);

    expect(parsedCatalog.meta).toStrictEqual({
      "Content-Transfer-Encoding": "8bit",
      "Content-Type": "text/plain; charset=utf-8",
      Language: "pt",
      "X-Generator": "next-intl",
    });
  });

  it("uses the generated ID as the runtime message key", () => {
    const codec = createPoCodec();

    const source = `msgid ""
msgstr ""
"Language: pt\\n"

msgctxt "settings.search"
msgid "Search"
msgstr "Pesquisar"
`;

    expect(codec.toJSONString(source, { locale: "pt" })).toBe(
      JSON.stringify({ settings: { search: "Pesquisar" } }),
    );
  });
});
