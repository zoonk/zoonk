import { describe, expect, it } from "vitest";
import { decodePage } from "./decode-page";

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.codePointAt(0) ?? 0);
}

describe(decodePage, () => {
  it("decodes a page in the charset its <meta> declares", () => {
    const html = `<meta charset="windows-1252"><p>Café</p>`;
    expect(decodePage({ bytes: latin1(html) })).toBe(html);
  });

  it("decodes a page in the charset its response declares", () => {
    const html = "<p>Presidência da República</p>";
    expect(decodePage({ bytes: latin1(html), charset: "ISO-8859-1" })).toBe(html);
  });

  it("decodes a UTF-16 page by its byte-order mark", () => {
    const html = `<a href="https://lumen.example/">Lumen</a>`;
    const units = Uint16Array.from(`﻿${html}`, (character) => character.codePointAt(0) ?? 0);

    expect(decodePage({ bytes: new Uint8Array(units.buffer) })).toBe(html);
  });

  it("reads UTF-8 when the page declares nothing or a charset no decoder knows", () => {
    const html = `<meta charset="x-unknown"><p>café</p>`;
    expect(decodePage({ bytes: new TextEncoder().encode(html) })).toBe(html);
  });

  it("reads a page that declares nothing as windows-1252 when its bytes aren't UTF-8", () => {
    const html = "<p>LEI Nº 12.813, Presidência da República</p>";
    expect(decodePage({ bytes: latin1(html) })).toBe(html);
  });

  it("keeps a declared UTF-8 page whole when one of its bytes is broken", () => {
    const html = `<meta charset="utf-8"><p>ação 日本語</p>`;
    const bytes = new Uint8Array([...new TextEncoder().encode(html), 0x3c, 0x21, 0x2d, 0x2d, 0xff]);

    expect(decodePage({ bytes })).toBe(`${html}<!--�`);
  });
});
