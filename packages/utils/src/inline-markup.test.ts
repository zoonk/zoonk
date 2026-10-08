import { describe, expect, it } from "vitest";
import { parseInlineMarkup } from "./inline-markup";

describe(parseInlineMarkup, () => {
  it("reads bold, italics with stars or underscores and inline code", () => {
    expect(
      parseInlineMarkup("Cada valor vale **10 mil viagens**; o filme *Caminhos*: `COUNT(*)`"),
    ).toStrictEqual([
      { kind: "text", text: "Cada valor vale " },
      { kind: "bold", text: "10 mil viagens" },
      { kind: "text", text: "; o filme " },
      { kind: "italic", text: "Caminhos" },
      { kind: "text", text: ": " },
      { kind: "code", text: "COUNT(*)" },
    ]);
  });

  it("leaves snake_case, multiplication, lone markers and markers inside code as text", () => {
    expect(parseInlineMarkup("user_id, 2 * 3 * 4 and SELECT * FROM t")).toStrictEqual([
      { kind: "text", text: "user_id, 2 * 3 * 4 and SELECT * FROM t" },
    ]);

    expect(parseInlineMarkup("Ich ___ nach Hause und du ____ _gern_?")).toStrictEqual([
      { kind: "text", text: "Ich ___ nach Hause und du ____ " },
      { kind: "italic", text: "gern" },
      { kind: "text", text: "?" },
    ]);

    expect(parseInlineMarkup("`a_b_c` and `**x**`")).toStrictEqual([
      { kind: "code", text: "a_b_c" },
      { kind: "text", text: " and " },
      { kind: "code", text: "**x**" },
    ]);
  });

  it("reads words in angle quotes as italics, without the marks", () => {
    expect(
      parseInlineMarkup("A legenda «Duas bolas no chão» combina; <<Três caixas>> não."),
    ).toStrictEqual([
      { kind: "text", text: "A legenda " },
      { kind: "italic", text: "Duas bolas no chão" },
      { kind: "text", text: " combina; " },
      { kind: "italic", text: "Três caixas" },
      { kind: "text", text: " não." },
    ]);

    expect(parseInlineMarkup("**Legenda**: « Mettre fin au lien »")).toStrictEqual([
      { kind: "bold", text: "Legenda" },
      { kind: "text", text: ": " },
      { kind: "italic", text: "Mettre fin au lien" },
    ]);
  });

  it("leaves unpaired angle quotes and shifts inside code as text", () => {
    expect(parseInlineMarkup("x << 2 and `a << b >> c` and «")).toStrictEqual([
      { kind: "text", text: "x << 2 and " },
      { kind: "code", text: "a << b >> c" },
      { kind: "text", text: " and «" },
    ]);
  });
});
