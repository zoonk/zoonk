import { describe, expect, it } from "vitest";
import { toPublicFirstScreen } from "./public-first-screen";

const guessHook = {
  options: [
    { id: "a", isCorrect: false, text: "$10^{-8}$" },
    { id: "b", isCorrect: false, text: "$10^6$" },
    { id: "c", isCorrect: true, text: "$10^2$" },
  ],
  question: "A lab display multiplies $10^4$ by $10^{-2}$. What should it show?",
  reveal: "It should show $10^2$. The next screen shows why.",
  variant: "guess",
};

const check = {
  basis: null,
  context: String.raw`Cíntia continua contando o tempo desde o início, mas troca a regra por $5 \times t$.`,
  options: [
    {
      id: "a",
      isCorrect: true,
      reason: "Você pode multiplicar 5 por zero. Já −1 s seria anterior ao início da medição.",
      text: "0 s é aceito; −1 s não.",
    },
    {
      id: "b",
      isCorrect: false,
      reason: "Você pode multiplicar 5 pelos dois números, mas −1 s não faz sentido como tempo.",
      text: "Os dois são aceitos.",
    },
  ],
  question: "Agora $t = 0$ e $t = -1$ são aceitos?",
};

const textHook = {
  text: "The Sun is **150,000,000,000** meters away. A hydrogen atom is **0.0000000001** meters wide.\n\nScientists write both in a few characters: $1.5 \\times 10^{11}$ m and $1 \\times 10^{-10}$ m.",
  variant: "text",
};

describe(toPublicFirstScreen, () => {
  it("keeps a guess's question and options as written, without the answer or the reveal", () => {
    const screen = toPublicFirstScreen({ content: guessHook, kind: "hook" });

    expect(screen).toStrictEqual({
      context: null,
      guess: true,
      kind: "choice",
      options: [
        { id: "a", text: "$10^{-8}$" },
        { id: "b", text: "$10^6$" },
        { id: "c", text: "$10^2$" },
      ],
      question: guessHook.question,
    });

    expect(JSON.stringify(screen)).not.toMatch(/isCorrect|next screen/u);
  });

  it("keeps a check's context, question and options as written, without reasons", () => {
    const screen = toPublicFirstScreen({ content: check, kind: "check" });

    expect(screen).toStrictEqual({
      context: check.context,
      guess: false,
      kind: "choice",
      options: [
        { id: "a", text: "0 s é aceito; −1 s não." },
        { id: "b", text: "Os dois são aceitos." },
      ],
      question: check.question,
    });

    expect(JSON.stringify(screen)).not.toMatch(/isCorrect|reason|multiplicar/u);
  });

  it("keeps the prices in a check's context", () => {
    const context =
      "Renan contrata um serviço que cobra R$ 30 pela visita e R$ 15 por aparelho verificado. Verificar 2 aparelhos custa R$ 60.";

    expect(toPublicFirstScreen({ content: { ...check, context }, kind: "check" })).toMatchObject({
      context,
    });
  });

  it("keeps a text hook's paragraphs, emphasis and math as written", () => {
    expect(toPublicFirstScreen({ content: textHook, kind: "hook" })).toStrictEqual({
      kind: "text",
      text: textHook.text,
    });
  });

  it("offers a start button for any other first screen", () => {
    expect(
      toPublicFirstScreen({ content: { text: "An explanation" }, kind: "explanation" }),
    ).toStrictEqual({ kind: "start" });
  });

  it("offers a start button when stored content doesn't match its kind", () => {
    expect(toPublicFirstScreen({ content: { question: "?" }, kind: "check" })).toStrictEqual({
      kind: "start",
    });
  });
});
