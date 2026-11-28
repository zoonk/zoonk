import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ENEM_RESEARCH_DATASET } from "./enem-answers";
import rows from "./enem-calibration-rows.json";
import { ENEM_PUBLISHED_CASES } from "./enem-published";
import { type WritingCase, basis } from "./shared";

const THEMES: Record<number, string> = {
  2016: "Caminhos para combater a intolerância religiosa no Brasil",
  2018: "Manipulação do comportamento do usuário pelo controle de dados na internet",
  2019: "Democratização do acesso ao cinema no Brasil",
  2020: "O estigma associado às doenças mentais na sociedade brasileira",
  2021: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil",
  2022: "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
  2023: "Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil",
  2024: "Desafios para a valorização da herança africana no Brasil",
};

const CSV_HASH = "c044a309c2d00dddbe8282f3ef09dfc053b1673f59c83d5fb18729f9e16588d8";

export const ENEM_CALIBRATION_MARKS = rows.map(({ row, total }) => ({
  answer: `enem-calibration-${row}-pt`,
  mark: total,
}));

function readRows(csv: string): string[][] {
  const parsed: string[][] = [];
  let row: string[] = [];

  for (const { groups } of csv.matchAll(
    /(?:"(?<quoted>(?:[^"]|"")*)"|(?<plain>[^,\r\n]*))(?<separator>,|\r?\n|$)/gu,
  )) {
    const { plain, quoted, separator } = groups ?? {};
    row.push(quoted === undefined ? (plain ?? "") : quoted.replaceAll('""', '"'));

    if (separator !== ",") {
      parsed.push(row);
      row = [];
    }
  }

  return parsed;
}

export async function loadEnemCalibrationCases(): Promise<WritingCase[]> {
  const file = process.env.WRITING_CALIBRATION_ENEM_CSV;
  const url = ENEM_RESEARCH_DATASET.replace("/blob/", "/resolve/");

  const csv = file
    ? await readFile(file, "utf8")
    : await fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error(`Pinned essay dataset returned HTTP ${response.status}.`);
        }

        return response.text();
      });

  if (createHash("sha256").update(csv).digest("hex") !== CSV_HASH) {
    throw new Error("The writing dataset does not match its pinned revision.");
  }

  const table = readRows(csv);
  const exemplar = ENEM_PUBLISHED_CASES[0]?.userInput;

  if (!exemplar) {
    throw new Error("Missing published rubric.");
  }

  return rows.map(({ row, scores, total, year }) => {
    const [actualYear, text, actualScores, actualTotal] = table[row] ?? [];
    const theme = THEMES[year];

    if (
      !text ||
      !theme ||
      Number(actualYear) !== year ||
      Number(actualTotal) !== total ||
      JSON.stringify(JSON.parse(actualScores ?? "null")) !== JSON.stringify(scores)
    ) {
      throw new Error(`The pinned essay row ${row} does not match its marks.`);
    }

    return {
      expected: {
        earned: [],
        feedbackLanguage: "pt",
        officialCompetences: Object.fromEntries(
          scores.map((score, index) => [`c${index + 1}`, score]),
        ),
        officialTotal: total,
        zero: false,
      },
      id: `enem-calibration-${row}-pt`,
      language: "pt",
      userInput: {
        ...exemplar,
        basis: basis({ ...exemplar.basis, aspects: [], title: theme, total: 1000 }),
        context: year === 2019 ? exemplar.context : null,
        keyPoints: [],
        question: `Escreva um texto dissertativo-argumentativo em português formal sobre “${theme}” e proponha uma intervenção que respeite os direitos humanos.`,
        text,
      },
    };
  });
}
