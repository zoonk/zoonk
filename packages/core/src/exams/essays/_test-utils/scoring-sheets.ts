import { type z } from "zod";
import { type writtenItemSchema } from "../writing-contract";
import { ENEM_GRADING } from "./scoring-sheets/enem-sheet";
import { IELTS_GRADING } from "./scoring-sheets/ielts-sheet";
import { CEBRASPE_GRADING, OAB_GRADING } from "./scoring-sheets/keyed-sheets";
import { AP_GRADING, HOLISTIC_GRADING } from "./scoring-sheets/rubric-sheets";

type WrittenItem = z.infer<typeof writtenItemSchema>;

export type ScoringSheetExample = Pick<
  WrittenItem,
  "aspects" | "grading" | "keySource" | "lines" | "points"
> & { handwritten: boolean };

export const SCORING_SHEET_EXAMPLES = {
  ap: {
    aspects: [],
    grading: AP_GRADING,
    handwritten: true,
    keySource: "notice",
    lines: null,
    points: 6,
  },
  cebraspe: {
    aspects: [
      {
        criterionId: "content",
        description:
          "Apresentação e estrutura textual: texto dissertativo em parágrafos, com introdução, desenvolvimento e conclusão",
        points: 3,
      },
      {
        criterionId: "content",
        description:
          "Os planos de estabilização anteriores ao Real fracassaram por não enfrentarem o déficit público",
        points: 9,
      },
      {
        criterionId: "content",
        description:
          "Instrumentos heterodoxos atuam diretamente sobre os preços; os ortodoxos, indiretamente, pelo nível de atividade",
        points: 9,
      },
      {
        criterionId: "content",
        description:
          "As três etapas do Plano Real: ajuste fiscal, Unidade Real de Valor e a nova moeda",
        points: 9,
      },
    ],
    grading: CEBRASPE_GRADING,
    handwritten: true,
    keySource: "practiceKey",
    lines: 30,
    points: 30,
  },
  enem: {
    aspects: [],
    grading: ENEM_GRADING,
    handwritten: true,
    keySource: "notice",
    lines: 30,
    points: 1000,
  },
  holistic: {
    aspects: [],
    grading: HOLISTIC_GRADING,
    handwritten: true,
    keySource: "notice",
    lines: null,
    points: 25,
  },
  ielts: {
    aspects: [],
    grading: IELTS_GRADING,
    handwritten: false,
    keySource: "notice",
    lines: null,
    points: 9,
  },
  oab: {
    aspects: [
      {
        criterionId: "a",
        description:
          "Não é necessário comum acordo para instaurar dissídio coletivo de natureza jurídica.",
        points: 0.75,
      },
      {
        criterionId: "a",
        description: "Fundamenta a conclusão no art. 114, § 2º, da Constituição.",
        points: 0.1,
      },
      {
        criterionId: "b",
        description: "A sentença normativa vigora por, no máximo, quatro anos.",
        points: 0.3,
      },
      {
        criterionId: "b",
        description:
          "Fundamenta o prazo no art. 868, parágrafo único, da CLT ou no Precedente Normativo 120 da SDC do TST.",
        points: 0.1,
      },
    ],
    grading: OAB_GRADING,
    handwritten: true,
    keySource: "publishedStandard",
    lines: 30,
    points: 1.25,
  },
} satisfies Record<string, ScoringSheetExample>;
