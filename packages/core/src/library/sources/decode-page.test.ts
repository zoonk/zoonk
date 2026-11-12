import { describe, expect, it } from "vitest";
import { decodePage } from "./decode-page";

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.codePointAt(0) ?? 0);
}

describe(decodePage, () => {
  it("decodes a page in the charset its <meta> declares", () => {
    const html = `<meta charset="windows-1252"><p>Café</p>`;
    expect(decodePage({ bytes: latin1(html), isHtml: true })).toBe(html);
  });

  it("decodes a page in the charset its response declares", () => {
    const html = "<p>Presidência da República</p>";
    expect(decodePage({ bytes: latin1(html), charset: "ISO-8859-1", isHtml: true })).toBe(html);
  });

  it("decodes a page by its <meta> when its response declares a charset no decoder knows", () => {
    const html = `<meta charset="windows-1251"><p>Привет</p>`;

    const bytes = new Uint8Array(
      Buffer.from(html.replace("Привет", "\u00CF\u00F0\u00E8\u00E2\u00E5\u00F2"), "latin1"),
    );

    expect(decodePage({ bytes, charset: "x-unknown", isHtml: true })).toBe(html);
  });

  it("decodes a UTF-16 page by its byte-order mark", () => {
    const html = `<a href="https://lumen.example/">Lumen</a>`;
    const units = Uint16Array.from(`﻿${html}`, (character) => character.codePointAt(0) ?? 0);

    expect(decodePage({ bytes: new Uint8Array(units.buffer), isHtml: true })).toBe(html);
  });

  it("reads UTF-8 when the page declares nothing or a charset no decoder knows", () => {
    const html = `<meta charset="x-unknown"><p>café</p>`;
    expect(decodePage({ bytes: new TextEncoder().encode(html), isHtml: true })).toBe(html);
  });

  it("reads a page that declares nothing as windows-1252 when its bytes aren't UTF-8", () => {
    const html = "<p>LEI Nº 12.813, Presidência da República</p>";
    expect(decodePage({ bytes: latin1(html), isHtml: true })).toBe(html);
  });

  it("keeps a declared UTF-8 page whole when one of its bytes is broken", () => {
    const html = `<meta charset="utf-8"><p>ação 日本語</p>`;
    const notUtf8 = 255;
    const bytes = new Uint8Array([...new TextEncoder().encode(`${html}<!--`), notUtf8]);

    expect(decodePage({ bytes, isHtml: true })).toBe(`${html}<!--�`);
  });
});
