import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./html-entities";

describe(decodeHtmlEntities, () => {
  it("turns accented letters back into the letters they stand for", () => {
    expect(decodeHtmlEntities("l&acirc;mpada, informa&ccedil;&atilde;o, &Eacute;, &uuml;")).toBe(
      "lâmpada, informação, É, ü",
    );
  });

  it("decodes numeric entities and common punctuation", () => {
    expect(decodeHtmlEntities("&#233; &#xE7; &quot;sim&quot; &amp; 3&nbsp;&Omega;")).toBe(
      'é ç "sim" & 3 &Omega;',
    );
  });

  it("leaves text without entities and unknown or invalid entities as written", () => {
    expect(decodeHtmlEntities("R$ 5 & R$ 6; &bogus; &#0; &zcedil;")).toBe(
      "R$ 5 & R$ 6; &bogus; &#0; &zcedil;",
    );
  });
});
