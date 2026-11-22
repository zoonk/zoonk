import { describe, expect, it } from "vitest";
import { isExampleQuote, isUnderlineQuote } from "./mark-quotes";

const text =
  "Seu salário bruto é o valor do contrato. Ana ganha **R$ 3.000** por mês. O que cai na conta dela é menor.";

describe(isUnderlineQuote, () => {
  it("takes plain words the rendered text shows together, through a bold term too", () => {
    expect(isUnderlineQuote({ quote: "o valor do contrato", text })).toBe(true);
    expect(isUnderlineQuote({ quote: "Ana ganha R$ 3.000 por mês", text })).toBe(true);
    expect(isUnderlineQuote({ quote: "R$ 3.000", text })).toBe(true);
    expect(isUnderlineQuote({ quote: "o valor de contrato", text })).toBe(false);
    expect(isUnderlineQuote({ quote: "**R$ 3.000**", text })).toBe(false);
    expect(isUnderlineQuote({ quote: " o valor", text })).toBe(false);
    expect(isUnderlineQuote({ quote: "", text })).toBe(false);
  });
});

const code = [
  "O `.then()` espera a vez.",
  "Neste código, o valor já existe:",
  "```javascript",
  "if (pronto) {",
  "  console.log('fim');",
  "}",
  "```",
  "Mesmo assim, o console mostra fim primeiro.",
].join("\n");

describe(isUnderlineQuote, () => {
  it("never points inside code, which the app never marks", () => {
    expect(isUnderlineQuote({ quote: "console.log('fim');", text: code })).toBe(false);
    expect(isUnderlineQuote({ quote: "o console mostra fim primeiro", text: code })).toBe(true);
  });
});

describe(isExampleQuote, () => {
  it("takes a code block whole, from the sentence before it to its closing fence", () => {
    const example = code.split("\n").slice(1, 7).join("\n");

    expect(isExampleQuote({ quote: example, text: code })).toBe(true);
    expect(isExampleQuote({ quote: code.split("\n").slice(1).join("\n"), text: code })).toBe(true);
  });

  it("never splits a code block", () => {
    const halfCode = code.split("\n").slice(1, 5).join("\n");
    const fromInside = code.split("\n").slice(5).join("\n");

    expect(isExampleQuote({ quote: halfCode, text: code })).toBe(false);
    expect(isExampleQuote({ quote: fromInside, text: code })).toBe(false);
  });

  it("takes whole sentences with their markup, from a sentence's start to its end", () => {
    expect(isExampleQuote({ quote: "Ana ganha **R$ 3.000** por mês.", text })).toBe(true);

    expect(
      isExampleQuote({
        quote: "Ana ganha **R$ 3.000** por mês. O que cai na conta dela é menor.",
        text,
      }),
    ).toBe(true);
  });

  it("refuses half a sentence, half a bold run and words the text doesn't have", () => {
    expect(isExampleQuote({ quote: "ganha **R$ 3.000** por mês.", text })).toBe(false);
    expect(isExampleQuote({ quote: "Ana ganha **R$ 3.000** por mês", text })).toBe(false);
    expect(isExampleQuote({ quote: "Ana ganha **R$ 3.000", text })).toBe(false);
    expect(isExampleQuote({ quote: "Ana ganha R$ 3.000 por mês.", text })).toBe(false);
  });

  it("takes a numbered item with its number, so the frame never leaves the number behind", () => {
    const steps =
      "Para fazer chá:\n\n1. Ferva a água.\n2. Coloque o saquinho.\n3. Espere 3 minutos.";

    expect(isExampleQuote({ quote: "2. Coloque o saquinho.", text: steps })).toBe(true);
    expect(isExampleQuote({ quote: "Coloque o saquinho.", text: steps })).toBe(false);
    expect(isExampleQuote({ quote: "Ferva a água.", text: steps })).toBe(false);
  });

  it("doesn't take a sentence that goes on after a quotation for two", () => {
    const japanese = "店員は「ありがとう。」と言った。次の人が来た。";
    const english = "She said “Hello.” and left. Next came Ana.";
    const french = "Il a dit « Bonjour. » et il est parti. Ana est venue.";

    expect(isExampleQuote({ quote: "と言った。", text: japanese })).toBe(false);
    expect(isExampleQuote({ quote: "店員は「ありがとう。」", text: japanese })).toBe(false);

    expect(isExampleQuote({ quote: "店員は「ありがとう。」と言った。", text: japanese })).toBe(
      true,
    );

    expect(isExampleQuote({ quote: "and left.", text: english })).toBe(false);
    expect(isExampleQuote({ quote: "She said “Hello.”", text: english })).toBe(false);
    expect(isExampleQuote({ quote: "Next came Ana.", text: english })).toBe(true);
    expect(isExampleQuote({ quote: "et il est parti.", text: french })).toBe(false);
  });

  it("reads sentences that end without a space, as Japanese does", () => {
    const japanese = "給料には総額がある。たとえば、アナは月に30万円もらう。手取りはもっと少ない。";

    expect(isExampleQuote({ quote: "たとえば、アナは月に30万円もらう。", text: japanese })).toBe(
      true,
    );

    expect(isExampleQuote({ quote: "アナは月に30万円もらう。", text: japanese })).toBe(false);

    const quoted = "たとえば、アナは「パン」を買う。税金は別だ。";

    expect(isExampleQuote({ quote: "を買う。", text: quoted })).toBe(false);
    expect(isExampleQuote({ quote: "税金は別だ。", text: quoted })).toBe(true);

    expect(
      isExampleQuote({
        quote: "店員は「ありがとう。」と言った。",
        text: "店員は「ありがとう。」と言った。次の人が来た。",
      }),
    ).toBe(true);
  });
});
