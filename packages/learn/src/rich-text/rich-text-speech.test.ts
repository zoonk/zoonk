import { describe, expect, it } from "vitest";
import { type MathWords } from "./math-words";
import { parseRichBlocks } from "./rich-text-parser";
import { speakRichBlocks, speakRichInline, speakSegments } from "./rich-text-speech";

const words: MathWords = {
  bar: (base) => `${base} bar`,
  cubeRoot: (radicand) => `cube root of ${radicand}`,
  cubed: "cubed",
  dot: (base) => `${base} dot`,
  fraction: ({ denominator, numerator }) => `${numerator} over ${denominator}`,
  hat: (base) => `${base} hat`,
  nthRoot: ({ index, radicand }) => `${index}th root of ${radicand}`,
  power: (exponent) => `to the power of ${exponent}`,
  root: (radicand) => `square root of ${radicand}`,
  squared: "squared",
  subscript: (index) => `sub ${index}`,
  tilde: (base) => `${base} tilde`,
  vector: (base) => `vector ${base}`,
};

function speak(text: string) {
  return speakRichInline({ text, words });
}

describe(speakRichInline, () => {
  it("says a card's fraction and power in words", () => {
    expect(speak(String.raw`$\frac{1}{2}$`)).toBe("1 over 2");
    expect(speak("$x^2$")).toBe("x squared");
    expect(speak(String.raw`$\dfrac{3}{4}$ of the pizza`)).toBe("3 over 4 of the pizza");
  });

  it("reads lesson sentences with math the way the learner sees them", () => {
    expect(
      speak(String.raw`Solve $k = \sqrt{2mE}/\hbar$ for the energy, then substitute $k_n$.`),
    ).toBe("Solve k = square root of 2mE /ℏ for the energy, then substitute k sub n.");

    expect(speak("Levels scale as $n^2$, so $E_2$ is four times $E_1$.")).toBe(
      "Levels scale as n squared, so E sub 2 is four times E sub 1.",
    );

    expect(
      speak(String.raw`An electron ($m_e = 9.109\times10^{-31}$ kg) is trapped in a box.`),
    ).toBe("An electron (m sub e = 9.109 × 10 to the power of −31 kg) is trapped in a box.");

    expect(
      speak(
        String.raw`$n = 0$ gives $\psi \equiv 0$, so there's no particle; the lowest state is $n = 1$ with $E_1 > 0$`,
      ),
    ).toBe("n = 0 gives ψ ≡ 0, so there's no particle; the lowest state is n = 1 with E sub 1 > 0");
  });

  it("says formulas as Android's TalkBack text does", () => {
    expect(speak(String.raw`$\frac{30}{120} = \frac{1}{4} = 25\%$`)).toBe(
      "30 over 120 = 1 over 4 = 25%",
    );

    expect(speak(String.raw`$v = \sqrt{\frac{GM}{r}}$`)).toBe("v = square root of GM over r");
    expect(speak("$x_1 + y_1$")).toBe("x sub 1 + y sub 1");
    expect(speak("$2^{10}$ and $a^3$")).toBe("2 to the power of 10 and a cubed");
    expect(speak(String.raw`$90^\circ$`)).toBe("90°");
    expect(speak(String.raw`$x = -3$`)).toBe("x = −3");
    expect(speak(String.raw`$0.75 \cdot 80$`)).toBe("0.75 × 80");

    expect(speak(String.raw`$\lambda\ (\text{nm}) = \dfrac{1240}{E\ (\text{eV})}$`)).toBe(
      "λ (nm) = 1240 over E (eV)",
    );
  });

  it("says functions, sets and text inside a formula as words a reader knows", () => {
    expect(speak(String.raw`$f(x) = \sin x$ for $x \in \mathbb{R}$`)).toBe(
      "f(x) = sin x for x ∈ ℝ",
    );

    expect(speak(String.raw`$v = 3\,\text{m/s}$`)).toBe("v = 3 m/s");
  });

  it("reads a script written with a space after its mark, as KaTeX draws it", () => {
    expect(speak("$x^ 2 + a_ {1}$")).toBe("x squared + a sub 1");
    expect(speak("$x^\t2$")).toBe("x squared");
  });

  it("names a root by its index", () => {
    expect(speak(String.raw`$\sqrt[3]{8} = 2$`)).toBe("cube root of 8 = 2");

    expect(speak(String.raw`$\sqrt[4]{16}$ and $\sqrt[n]{x}$`)).toBe(
      "4th root of 16 and nth root of x",
    );

    expect(speak(String.raw`$\sqrt[2]{9}$`)).toBe("square root of 9");
    expect(speak("$\\sqrt\t[3]{8}$")).toBe("cube root of 8");
  });

  it("says the accent that changes what a letter means", () => {
    expect(
      speak(String.raw`The mean $\bar{x}$ estimates $\mu$, and $\hat{p}$ estimates $p$.`),
    ).toBe("The mean x bar estimates μ, and p hat estimates p.");

    expect(speak(String.raw`$\vec{v} = \dot{x}$`)).toBe("vector v = x dot");
  });

  it("reads over-escaped commands from AI output as the formula drawn", () => {
    expect(speak(String.raw`$a \\rightarrow b$`)).toBe(speak(String.raw`$a \rightarrow b$`));
    expect(speak(String.raw`$a \\rightarrow b$`)).toBe("a → b");
  });

  it("says a display formula and the text around it", () => {
    expect(speak("The speed is $$v =\n  \\sqrt{\\frac{GM}{r}}$$ in orbit.")).toBe(
      "The speed is v = square root of GM over r in orbit.",
    );
  });

  it("drops emphasis and code marks but keeps their words", () => {
    expect(speak("**Mitochondria** make _most_ of the cell's energy with `ATP`.")).toBe(
      "Mitochondria make most of the cell's energy with ATP.",
    );

    expect(speak("Type `x^2` to square it.")).toBe("Type x^2 to square it.");
  });

  it("keeps a card's leading dash or number, as the card shows them", () => {
    expect(speak("- 3")).toBe("- 3");
    expect(speak("1. $x^2$")).toBe("1. x squared");
  });

  it("never crashes on a word that names a built-in property", () => {
    expect(speak(String.raw`$\text{toString} + x^\text{constructor}$`)).toBe(
      "toString + x to the power of constructor",
    );

    expect(speak(String.raw`$\constructor$`)).toBe("constructor");
  });

  it("reads a very long formula without running out of stack", () => {
    const letters = "x".repeat(20_000);

    expect(speak(`$${letters}$`)).toBe(letters);
    expect(speak(String.raw`$\text{${letters}}$`)).toBe(letters);
  });

  it("leaves prices and text without math as written", () => {
    expect(speak("It costs $5 and then $10.")).toBe("It costs $5 and then $10.");
    expect(speak("Photosynthesis")).toBe("Photosynthesis");
  });
});

describe(speakRichBlocks, () => {
  it("reads a question's lines and list items, and leaves its table to the table", () => {
    const table = "\n\n| Name | Value |\n| --- | --- |\n| Half | 0.5 |";

    expect(
      speakRichBlocks({
        text: String.raw`Which value is closest to $\frac{1}{2}$?${table}`,
        words,
      }),
    ).toBe("Which value is closest to 1 over 2?");

    expect(
      speakRichBlocks({ text: "Pick the true one:\n- $x^2$ is never negative\n- $5 > 3$", words }),
    ).toBe("Pick the true one: x squared is never negative 5 > 3");
  });
});

describe(speakSegments, () => {
  it("says a table's header cells with their math", () => {
    const [table] = parseRichBlocks("| Shape | Area $A$ |\n| --- | --- |\n| Circle | $\\pi r^2$ |");
    const header = table?.kind === "table" ? table.header : [];

    expect(header.map((cell) => speakSegments({ segments: cell, words }))).toStrictEqual([
      "Shape",
      "Area A",
    ]);
  });
});
