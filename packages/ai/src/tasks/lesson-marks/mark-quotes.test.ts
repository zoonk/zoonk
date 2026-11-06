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

describe(isExampleQuote, () => {
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
