import { type TestCase } from "@/lib/types";
import { type AnswerFromMaterialInput } from "@zoonk/ai/tasks/v2/material/answer";
import { GLYCOLYSIS_SLIDES, MARKET_NOTES } from "../cite-material/material-fixtures";

export type AnswerFromMaterialExpected = {
  found: boolean;
  /** Accepts any listed page; an empty list means the material does not cover the question. */
  refs: string[];
  /** Each entry requires one alternative, ignoring case and accents. */
  mentions: string[][];
};

export const TEST_CASES: TestCase<AnswerFromMaterialExpected, AnswerFromMaterialInput>[] = [
  {
    expected: { found: true, mentions: [["2 atp", "dois atp"], ["4"]], refs: ["S1:6", "S1:10"] },
    id: "pt-glycolysis-net-yield",
    userInput: {
      language: "pt",
      material: GLYCOLYSIS_SLIDES,
      question: "Por que a glicólise rende só 2 ATP se ela produz 4?",
    },
  },
  {
    expected: { found: true, mentions: [["cmc", "cito"]], refs: ["S1:3"] },
    id: "pt-stages-mnemonic",
    userInput: {
      language: "pt",
      material: GLYCOLYSIS_SLIDES,
      question: "qual era o macete da prof pra lembrar onde acontece cada etapa?",
    },
  },
  {
    expected: { found: false, mentions: [], refs: [] },
    id: "pt-not-covered-photosynthesis",
    userInput: {
      language: "pt",
      material: GLYCOLYSIS_SLIDES,
      question: "Como funciona a fase clara da fotossíntese?",
    },
  },
  {
    expected: { found: true, mentions: [["shortage"]], refs: ["S2:4"] },
    id: "en-rent-control",
    userInput: {
      language: "en",
      material: MARKET_NOTES,
      question: "What happens with rent control?",
    },
  },
  {
    expected: { found: false, mentions: [], refs: [] },
    id: "en-not-covered-elasticity",
    userInput: {
      language: "en",
      material: MARKET_NOTES,
      question: "How do I calculate price elasticity of demand?",
    },
  },
];
