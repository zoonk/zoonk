import { type TestCase } from "@/lib/types";
import { type AnswerFromMaterialInput } from "@zoonk/ai/tasks/material/answer";
import { GLYCOLYSIS_SLIDES, MARKET_NOTES } from "../cite-material/material-fixtures";

/**
 * Photos of notes are transcribed with math in LaTeX: these are the transcription eval's own pages,
 * as its production model wrote them.
 */
const INTEGRALS_PHOTO = String.raw`<page ref="S1:1" of="Integrals review photo">
# Integrals - review

$\int_0^1 x^2\,dx = \frac{1}{3}$

$\int e^{-x}\,dx = -e^{-x} + C$

$\int \frac{1}{x}\,dx = \ln|x| + C$

$\int_0^\pi \sin x\,dx = 2$

By parts: $\int u\,dv = uv - \int v\,du$
</page>`;

const PHYSICS_PHOTO = String.raw`<page ref="S1:1" of="Foto do caderno de física">
# Cinemática - MUV

Velocidade média: $v_m = \Delta s / \Delta t$

Aceleração: $a = \Delta v / \Delta t$ (unidade: $m/s^2$)

Função horária: $s = s_0 + v_0 \cdot t + a \cdot t^2 / 2$

Ex.: $s = 12 - 3,5 \cdot t$ → $v_0 = -3,5$ m/s

(movimento retrógrado)

Freando: $a = -2,5$ m/s² (sinal contrário ao de v)

Mov. uniformemente variado: $a$ constante $\neq 0$

Exercício 4: um carro a 20 m/s freia com $a = -2,5$ m/s². Em quanto tempo ele para?
</page>`;

const CHEMISTRY_PHOTO = String.raw`<page ref="S1:1" of="Thermochemistry notes photo">
# Thermochemistry - notes

- Exothermic: releases heat, ΔH < 0
- Endothermic: absorbs heat, ΔH > 0

$2H_2 + O_2 \longrightarrow 2H_2O \quad \Delta H = -572$ kJ

Combustion of methane: $\Delta H = -890$ kJ/mol

Melting ice is endothermic: $\Delta H = +6.01$ kJ/mol

Hess's law: $\Delta H$ of the overall reaction = sum of $\Delta H$ of the steps (path doesn't matter)
</page>`;

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
  {
    expected: { found: true, mentions: [["ln"]], refs: ["S1:1"] },
    id: "en-latex-notes-integral-of-one-over-x",
    userInput: {
      language: "en",
      material: INTEGRALS_PHOTO,
      question: "what's the integral of 1/x again?",
    },
  },
  {
    expected: { found: true, mentions: [["uv"]], refs: ["S1:1"] },
    id: "en-latex-notes-integration-by-parts",
    userInput: {
      language: "en",
      material: INTEGRALS_PHOTO,
      question: "How does integration by parts go?",
    },
  },
  {
    expected: { found: true, mentions: [["Δs", "delta s", "deslocamento", "espaco"]], refs: ["S1:1"] },
    id: "pt-latex-notes-average-speed",
    userInput: {
      language: "pt",
      material: PHYSICS_PHOTO,
      question: "qual é a fórmula da velocidade média?",
    },
  },
  {
    expected: { found: true, mentions: [["contrario", "oposto"]], refs: ["S1:1"] },
    id: "pt-latex-notes-braking-sign",
    userInput: {
      language: "pt",
      material: PHYSICS_PHOTO,
      question: "Por que a aceleração do carro freando é negativa?",
    },
  },
  {
    expected: { found: true, mentions: [["endothermic"], ["6.01"]], refs: ["S1:1"] },
    id: "en-latex-notes-melting-ice",
    userInput: {
      language: "en",
      material: CHEMISTRY_PHOTO,
      question: "Is melting ice exothermic or endothermic, and by how much?",
    },
  },
  {
    expected: { found: true, mentions: [["572"]], refs: ["S1:1"] },
    id: "en-latex-notes-burning-hydrogen",
    userInput: {
      language: "en",
      material: CHEMISTRY_PHOTO,
      question: "How much heat does burning hydrogen give off?",
    },
  },
];
