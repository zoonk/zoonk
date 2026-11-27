import { type WritingSheet } from "../../../../library/exams/written-grading";
import { from } from "./cite";

const oabNotice = from("fgv-oab-notice");
const oabStandard = from("fgv-oab-standard");

export const OAB_GRADING: WritingSheet = {
  combination: oabStandard("A nota da questão é a soma dos pontos dos itens A e B.", {
    method: "sum" as const,
    step: null,
  }),
  conventions: [
    oabStandard(
      "O examinando deve fundamentar suas respostas. A mera citação ou transcrição do dispositivo legal não confere pontuação.",
    ),
  ],
  criteria: [
    oabStandard("Item A", { id: "a", points: 0.85 }),
    oabStandard("Item B", { id: "b", points: 0.4 }),
  ],
  language: null,
  rounding: null,
  zeroing: [
    oabNotice("Não há resposta escrita.", { kinds: ["blank" as const] }),
    oabNotice("A resposta, no todo, não trata da situação nem do conteúdo avaliado.", {
      kinds: ["offTopic" as const],
    }),
    oabNotice("A resposta traz marca ou assinatura que identifica o examinando.", {
      kinds: ["identification" as const],
    }),
  ],
};

const cgu = from("cebraspe-cgu-2026-notice");

export const CEBRASPE_GRADING: WritingSheet = {
  criteria: [
    cgu(
      "A apresentação e a estrutura textuais e o desenvolvimento do tema somam a nota de domínio do conteúdo (NC), limitada a 30,00 pontos.",
      { id: "content", points: 30 },
    ),
  ],
  language: cgu(
    "O domínio da modalidade escrita soma o número de erros (NE) de grafia, morfossintaxe e propriedade vocabular; TL é o número de linhas efetivamente escritas.",
    { factor: 6, formula: "NQ1 = NC - 6 × NE ÷ TL", method: "errorsPerLine" as const },
  ),
  rounding: null,
  zeroing: [
    cgu("Fuga ao tema ou ausência de texto: nota zero na questão.", {
      kinds: ["blank" as const, "offTopic" as const],
    }),
  ],
};
