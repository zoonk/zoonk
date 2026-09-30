type JsonLdValue = boolean | number | string | JsonLdObject | JsonLdValue[];
export type JsonLdObject = { [key: string]: JsonLdValue | undefined };

/** `<` can't close the script tag once escaped, so text from content can't break out of it. */
function serialize(data: JsonLdObject): string {
  return JSON.stringify(data).replaceAll("<", String.raw`<`);
}

/** Structured data for search engines, one script per schema.org item. */
export function JsonLd({ items }: { items: JsonLdObject[] }) {
  return items.map((item, index) => (
    <script
      // oxlint-disable-next-line react/no-danger -- JSON-LD must be raw JSON; `serialize` escapes `<`.
      dangerouslySetInnerHTML={{ __html: serialize(item) }}
      // oxlint-disable-next-line react/no-array-index-key -- The list is static per render.
      key={index}
      type="application/ld+json"
    />
  ));
}
