const CLDR_ORDER = ["zero", "one", "two", "few", "many", "other"];

const PLURAL =
  /(?<indent> *)<plurals(?<attributes>[^>]*)>(?<body>[\s\S]*?)\n\k<indent><\/plurals>/u;

const PLURALS = new RegExp(PLURAL.source, "gu");

const ITEM = /(?<itemIndent> *)<item quantity="(?<quantity>\w+)">(?<text>[\s\S]*?)<\/item>/gu;

/**
 * Android Lint requires every plural category the locale's rules have (French and Portuguese
 * `many`), which translations often leave out. A missing one gets the `other` text, which is what
 * Android shows for it anyway.
 */
export function completePluralCategories({ locale, xml }: { locale: string; xml: string }) {
  const categories = new Set<string>(
    new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
  );

  return xml.replaceAll(PLURALS, (block) => {
    const groups = PLURAL.exec(block)?.groups;

    if (!groups) {
      return block;
    }

    const items = [...(groups.body ?? "").matchAll(ITEM)].map((item) => item.groups ?? {});
    const texts = new Map(items.map((item) => [item.quantity, item.text]));
    const other = texts.get("other");

    if (other === undefined || [...categories].every((category) => texts.has(category))) {
      return block;
    }

    const itemIndent = items[0]?.itemIndent ?? `${groups.indent}    `;

    const lines = CLDR_ORDER.filter(
      (category) => texts.has(category) || categories.has(category),
    ).map(
      (category) =>
        `${itemIndent}<item quantity="${category}">${texts.get(category) ?? other}</item>`,
    );

    return `${groups.indent}<plurals${groups.attributes}>\n${lines.join("\n")}\n${groups.indent}</plurals>`;
  });
}
