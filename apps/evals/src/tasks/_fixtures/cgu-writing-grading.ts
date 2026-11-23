import { type WritingPromptInput } from "@zoonk/ai/tasks/items/write-writing-prompt";

const CGU_NOTICE = "cgu-2026-affc-edital-1";

export function cguWritingGrading({
  formula,
  factor,
  item,
  total,
}: {
  formula: string;
  factor: number;
  item: string;
  total: number;
}): WritingPromptInput["task"]["grading"] {
  return {
    criteria: [
      {
        citation: {
          passage: `${item} … a) a apresentação e a estrutura textuais e o desenvolvimento do tema totalizarão a nota relativa ao domínio do conteúdo (NC), cuja pontuação máxima será limitada ao valor de ${total},00 pontos;`,
          sourceId: CGU_NOTICE,
        },
        id: "content",
        points: total,
        text: "a apresentação e a estrutura textuais e o desenvolvimento do tema (NC)",
      },
    ],
    kind: "points",
    language: {
      citation: {
        passage: `${item} … d) será calculada, então, a nota … pela fórmula ${formula}, em que TL corresponde ao número de linhas efetivamente escritas pelo candidato;`,
        sourceId: CGU_NOTICE,
      },
      factor,
      formula,
      method: "errorsPerLine",
      text: "a avaliação do domínio da modalidade escrita totalizará o número de erros (NE) do candidato, considerando-se aspectos de natureza gramatical, tais como: grafia, morfossintaxe e propriedade vocabular",
    },
    rounding: null,
    zeroing: [
      {
        citation: {
          passage: `${item} … f) nos casos de fuga ao tema ou de não haver texto, o candidato receberá nota na questão igual a zero.`,
          sourceId: CGU_NOTICE,
        },
        kinds: ["blank", "offTopic"],
        text: "fuga ao tema ou ausência de texto",
      },
    ],
  };
}
