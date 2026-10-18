import { describe, expect, it } from "vitest";
import { parseItemLine, parseItemText } from "./item-text";

const NO_BREAK_SPACE = "\u00A0";

function text(value: string) {
  return [{ kind: "text", text: value }];
}

describe(parseItemText, () => {
  it("reads a support text with a GFM table as a paragraph, the table and a closing paragraph", () => {
    const blocks = parseItemText(
      [
        "Uma pesquisa registrou viagens em dois anos:",
        "",
        "| Modalidade | 2022 | 2023 |",
        "|---|---:|:---:|",
        "| Ônibus | 240 | 250 |",
        "| Metrô | 180 |",
        "",
        "Um relatório concluiu que o metrô cresceu.",
      ].join("\n"),
    );

    expect(blocks).toStrictEqual([
      { kind: "paragraph", lines: [text("Uma pesquisa registrou viagens em dois anos:")] },
      {
        align: [null, "right", "center"],
        header: [text("Modalidade"), text("2022"), text("2023")],
        kind: "table",
        rows: [
          [text("Ônibus"), text("240"), text("250")],
          [text("Metrô"), text("180"), []],
        ],
      },
      { kind: "paragraph", lines: [text("Um relatório concluiu que o metrô cresceu.")] },
    ]);
  });

  it("starts a table right under a paragraph line and stops it at a line without pipes", () => {
    const blocks = parseItemText(
      "Os dados:\nAno | Total\n:-- | --\n2024 | 10\nEntão o total subiu.\nMesmo assim, caiu.",
    );

    expect(blocks).toStrictEqual([
      { kind: "paragraph", lines: [text("Os dados:")] },
      {
        align: ["left", null],
        header: [text("Ano"), text("Total")],
        kind: "table",
        rows: [[text("2024"), text("10")]],
      },
      { kind: "paragraph", lines: [text("Então o total subiu."), text("Mesmo assim, caiu.")] },
    ]);
  });

  it("keeps pipes that aren't a table as text, and escaped pipes inside a cell", () => {
    expect(parseItemText("Um oscilador está em |2⟩ e a†|n⟩ = √(n + 1)|n + 1⟩.")).toStrictEqual([
      { kind: "paragraph", lines: [text("Um oscilador está em |2⟩ e a†|n⟩ = √(n + 1)|n + 1⟩.")] },
    ]);

    expect(parseItemText("| a | b |\n|---|\n| 1 | 2 |")).toStrictEqual([
      { kind: "paragraph", lines: [text("| a | b |"), text("|---|"), text("| 1 | 2 |")] },
    ]);

    expect(parseItemText("| Regra |\n|---|\n| x \\| y |")).toStrictEqual([
      { align: [null], header: [text("Regra")], kind: "table", rows: [[text("x | y")]] },
    ]);
  });

  it("reads emphasis in paragraphs and cells, and keeps amounts on one line", () => {
    expect(
      parseItemText(
        "Cada valor vale **10 mil viagens**.\n\n| Grupo | Aluguel |\n|---|---|\n| *A* | R$ 1.200,00 |",
      ),
    ).toStrictEqual([
      {
        kind: "paragraph",
        lines: [
          [
            { kind: "text", text: "Cada valor vale " },
            { kind: "bold", text: "10 mil viagens" },
            { kind: "text", text: "." },
          ],
        ],
      },
      {
        align: [null, null],
        header: [text("Grupo"), text("Aluguel")],
        kind: "table",
        rows: [[[{ kind: "italic", text: "A" }], text(`R$${NO_BREAK_SPACE}1.200,00`)]],
      },
    ]);
  });
});

describe(parseItemLine, () => {
  it("reads a command on one line with its emphasis and amounts kept together", () => {
    expect(parseItemLine("Quanto custa\n o *pacote* de 96,00 € ou 40 %?")).toStrictEqual([
      { kind: "text", text: "Quanto custa o " },
      { kind: "italic", text: "pacote" },
      { kind: "text", text: ` de 96,00${NO_BREAK_SPACE}€ ou 40${NO_BREAK_SPACE}%?` },
    ]);
  });
});
