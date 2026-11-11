import { assert, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { splitLawArticlePieces, splitLawArticles, toArticleNumber } from "./law-articles";

function headings(text: string) {
  return splitLawArticles(text).map((article) => [article.heading, article.number]);
}

describe(splitLawArticles, () => {
  it("keeps a Brazilian article's paragraphs with it", () => {
    const law = [
      "LEI Nº 12.813, DE 16 DE MAIO DE 2013",
      "Art. 4º O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir conflito de interesses.",
      "§ 1º No caso de dúvida, o agente público deverá consultar a Comissão de Ética Pública.",
      "§ 2º A ocorrência de conflito de interesses independe da existência de lesão ao patrimônio público.",
      "Art. 4º-A Artigo incluído depois.",
      "Art. 5º Configura conflito de interesses:",
    ].join("\n");

    expect(splitLawArticles(law)).toStrictEqual([
      {
        body: [
          "O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir conflito de interesses.",
          "§ 1º No caso de dúvida, o agente público deverá consultar a Comissão de Ética Pública.",
          "§ 2º A ocorrência de conflito de interesses independe da existência de lesão ao patrimônio público.",
        ].join("\n"),
        documentPart: 1,
        heading: "Art. 4º",
        number: "4",
        text: law.split("\n").slice(1, 4).join("\n"),
      },
      {
        body: "Artigo incluído depois.",
        documentPart: 1,
        heading: "Art. 4º-A",
        number: "4-A",
        text: "Art. 4º-A Artigo incluído depois.",
      },
      {
        body: "Configura conflito de interesses:",
        documentPart: 1,
        heading: "Art. 5º",
        number: "5",
        text: "Art. 5º Configura conflito de interesses:",
      },
    ]);
  });

  it("reads the headings of Portuguese, Spanish, English, German, French and Japanese texts", () => {
    expect(headings("Artigo 1.º Objeto\nArtigo 2.º Âmbito")).toStrictEqual([
      ["Artigo 1.º", "1"],
      ["Artigo 2.º", "2"],
    ]);

    expect(headings("Artículo 1. Objeto.\nArtículo 12 bis. Datos.")).toStrictEqual([
      ["Artículo 1", "1"],
      ["Artículo 12 bis", "12bis"],
    ]);

    expect(
      headings("Article 1\nAll human beings are born free.\nArticle 2\nEveryone."),
    ).toStrictEqual([
      ["Article 1", "1"],
      ["Article 2", "2"],
    ]);

    expect(headings("Article 1er La loi.\nArticle 2 Le décret.")).toStrictEqual([
      ["Article 1er", "1"],
      ["Article 2", "2"],
    ]);

    expect(headings("Sec. 2. Definitions.\nSEC. 3. Rules.")).toStrictEqual([
      ["Sec. 2", "2"],
      ["SEC. 3", "3"],
    ]);

    expect(headings("§ 433 Vertragstypische Pflichten\n§ 434 Sachmangel")).toStrictEqual([
      ["§ 433", "433"],
      ["§ 434", "434"],
    ]);

    expect(headings("第一条　この法律は\n第十二条　前条の規定")).toStrictEqual([
      ["第一条", "1"],
      ["第十二条", "12"],
    ]);
  });

  it("starts a new part where numbering starts again, as in an appended amendment", () => {
    const constitution = [
      "Art. 1º A República Federativa do Brasil tem como fundamentos a soberania.",
      "Art. 2º São Poderes da União o Legislativo, o Executivo e o Judiciário.",
      "Art. 2º Redação anterior, revogada, mostrada ao lado da atual.",
      "EMENDA CONSTITUCIONAL Nº 139",
      "Art. 1º Esta Emenda altera o art. 2º da Constituição.",
    ].join("\n");

    expect(
      splitLawArticles(constitution).map((article) => [article.heading, article.documentPart]),
    ).toStrictEqual([
      ["Art. 1º", 1],
      ["Art. 2º", 1],
      ["Art. 2º", 1],
      ["Art. 1º", 2],
    ]);
  });

  it("never takes a citation inside a sentence or a quoted article for a heading", () => {
    const law = [
      "Art. 1º Esta Lei altera o art. 37 da Constituição.",
      'Art. 2º O art. 37 passa a vigorar com a seguinte redação: "Art. 37. A administração pública."',
      '"Art. 38. Ao servidor público."',
    ].join("\n");

    expect(headings(law)).toStrictEqual([
      ["Art. 1º", "1"],
      ["Art. 2º", "2"],
    ]);
  });

  it("finds no articles in a text with no headings", () => {
    expect(splitLawArticles("Guia do contribuinte. Veja o art. 5º da lei.")).toStrictEqual([]);
  });
});

describe(splitLawArticlePieces, () => {
  it("labels an appended amendment's articles apart from the main text's", () => {
    const text = [
      "Art. 1º Texto principal.",
      "Art. 2º Mais texto.",
      "Art. 3º Fim do texto principal.",
      "Art. 1º Artigo da emenda.",
    ].join("\n");

    expect(splitLawArticlePieces(text)?.map((piece) => piece.label)).toStrictEqual([
      "Art. 1º",
      "Art. 2º",
      "Art. 3º",
      "Text 2, Art. 1º",
    ]);
  });

  it("splits a long article between paragraphs into pieces that repeat its heading", () => {
    const items = Array.from(
      { length: 80 },
      (_, index) => `${index + 1} - inciso ${"com texto longo ".repeat(6).trim()};`,
    );

    const text = [
      "Art. 5º Todos são iguais perante a lei:",
      ...items,
      "Art. 6º São direitos sociais a educação.",
      "Art. 7º São direitos dos trabalhadores.",
    ].join("\n");

    const pieces = splitLawArticlePieces(text) ?? [];
    const article = pieces.filter((piece) => piece.number === "5");

    expect(article.map((piece) => piece.label)).toStrictEqual([
      "Art. 5º",
      "Art. 5º, part 2",
      "Art. 5º, part 3",
    ]);

    expect(article.slice(1).every((piece) => piece.text.startsWith("Art. 5º\n"))).toBe(true);

    expect(
      article.flatMap((piece) => piece.text.split("\n")).filter((line) => line !== "Art. 5º"),
    ).toStrictEqual(["Art. 5º Todos são iguais perante a lei:", ...items]);
  });

  it("leaves a text with too few articles to its ordinary pages", () => {
    expect(splitLawArticlePieces("Art. 1º Só um.\nArt. 2º E outro.")).toBeNull();
  });

  it("keeps every line of every article in exactly one piece, whatever the text", () => {
    assert(
      property(string({ unit: "grapheme" }), string({ unit: "grapheme" }), (first, second) => {
        const text = `Art. 1º ${first}\nArt. 2º ${second}\nArt. 3º Fim.`;

        const lines = splitLawArticles(text).flatMap((article) =>
          article.text
            .split(/[\n\f]/u)
            .map((line) => line.trim())
            .filter(Boolean),
        );

        const pieces = (splitLawArticlePieces(text) ?? []).flatMap((piece) =>
          piece.text.split("\n").slice(piece.label.includes(", part ") ? 1 : 0),
        );

        expect(pieces).toStrictEqual(lines);
      }),
    );
  });
});

describe(toArticleNumber, () => {
  it("reads the article a hint names", () => {
    expect(
      ["Art. 4º, § 2º", "art. 4", "4", "Artículo 4.", "第四条", "Art. 4º-A", "Article 4bis"].map(
        (hint) => toArticleNumber(hint),
      ),
    ).toStrictEqual(["4", "4", "4", "4", "4", "4-A", "4"]);

    expect(toArticleNumber("o caput")).toBeNull();
  });
});
