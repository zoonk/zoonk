import { FGV_PUBLISHED_CASES } from "../grade-essay/cases/fgv-published";

/**
 * Full-credit FGV answers with one itemized espelho element removed or contradicted. `removed`
 * lists the board aspects the edit takes away; `dependent` lists citations that FGV credits only
 * in support of the answer the edit contradicts, which makes the edit ambiguous: its mark is then
 * read blind by two readers and kept as an interval between the espelho's bounds.
 */
export type Ablation = {
  id: string;
  caseId: string;
  edits: [from: string, to: string][];
  removed: number[];
  dependent: number[];
};

export const ABLATIONS: Ablation[] = [
  {
    caseId: "fgv-oab-xv-labor-q1-pt",
    dependent: [],
    edits: [["é de 4 anos, nos termo do art. 868 da CLT, e PN 120 SDC do TST.", "é de 4 anos."]],
    id: "labor-q1-no-b-basis",
    removed: [3],
  },
  {
    caseId: "fgv-oab-xv-labor-q1-pt",
    dependent: [3],
    edits: [
      ["é de 4 anos", "é de 2 anos"],
      ["não poderá ultrapassar quatro anos", "não poderá ultrapassar dois anos"],
    ],
    id: "labor-q1-b-two-years",
    removed: [2],
  },
  {
    caseId: "fgv-oab-xv-labor-q1-pt",
    dependent: [1],
    edits: [
      [
        "A) Não pois nos termos do art. 114, § 2º da CF, o comum acordo só se faz necessário para ajuizar dissídio coletivo de natureza salarial, não sendo esse requisito necessário para ajuizamento de dissídio coletivo de natureza jurídica.",
        "A) Sim, pois nos termos do art. 114, § 2º da CF, o comum acordo é necessário para ajuizar qualquer dissídio coletivo, inclusive o de natureza jurídica.",
      ],
    ],
    id: "labor-q1-a-agreement-required",
    removed: [0],
  },
  {
    caseId: "fgv-oab-xv-labor-q2-pt",
    dependent: [],
    edits: [
      [
        "A medida cabível é o mandado de segurança, nos termos da súmula 414, II do TST. Pois a decisão proferida pelo juiz é interlocutória, e contra decisões interlocutórias não cabem recurso, conforme art. 893, § 1º da CLT, sendo assim, quando inexiste recurso próprio é cabível o mandado de segurança conforme disciplina o art. 5º da lei 12.016/2009, OJ 92 SDI-2 e súmula 267 do STF.",
        "A medida cabível é o mandado de segurança. Pois a decisão proferida pelo juiz é interlocutória, e contra decisões interlocutórias não cabem recurso, sendo assim, quando inexiste recurso próprio é cabível o mandado de segurança.",
      ],
    ],
    id: "labor-q2-no-a-basis",
    removed: [1],
  },
  {
    caseId: "fgv-oab-xv-labor-q2-pt",
    dependent: [1],
    edits: [
      [
        "A) A medida cabível é o mandado de segurança, nos termos da súmula 414, II do TST. Pois a decisão proferida pelo juiz é interlocutória, e contra decisões interlocutórias não cabem recurso, conforme art. 893, § 1º da CLT, sendo assim, quando inexiste recurso próprio é cabível o mandado de segurança conforme disciplina o art. 5º da lei 12.016/2009, OJ 92 SDI-2 e súmula 267 do STF.",
        "A) A medida cabível é o agravo de instrumento, nos termos da súmula 414, II do TST, pois a decisão que antecipa a tutela pode ser impugnada de imediato por recurso próprio, conforme art. 893, § 1º da CLT.",
      ],
    ],
    id: "labor-q2-a-agravo",
    removed: [0],
  },
  {
    caseId: "fgv-oab-xv-labor-q2-pt",
    dependent: [4],
    edits: [
      [
        "a contar da ciência da sentença. E a ação cautelar, o qual é o meio próprio para obter efeito suspensivo ao recurso, nos termos da súmula 414, I do TST.\nOs recursos em regra tem efeitos meramente devolutivos, para que os mesmos tenham efeito suspensivo a medida judicial é a ação cautelar.\nSendo assim a sentença será impugnada mediante recurso ordinário e ação cautelar. (súmula 414, I, TST).",
        "a contar da ciência da sentença, nos termos da súmula 414, I do TST.\nSendo assim a sentença será impugnada mediante recurso ordinário. (súmula 414, I, TST).",
      ],
    ],
    id: "labor-q2-no-cautelar",
    removed: [3],
  },
  {
    caseId: "fgv-oab-xv-labor-q3-pt",
    dependent: [],
    edits: [
      [
        "nos termos do art. 7º, XXXIII da CF e art. 404 da CLT os quais proíbem o trabalho noturno para menores de 18 anos.",
        "pois a lei proíbe o trabalho noturno para menores de 18 anos.",
      ],
    ],
    id: "labor-q3-no-b-basis",
    removed: [3],
  },
  {
    caseId: "fgv-oab-xv-labor-q3-pt",
    dependent: [3],
    edits: [
      [
        "Sendo assim não poderia ser designada para trabalhar em horário noturno, nos termos do art. 7º, XXXIII da CF e art. 404 da CLT os quais proíbem o trabalho noturno para menores de 18 anos.",
        "Ainda assim poderia ser designada para trabalhar em horário noturno, pois o art. 7º, XXXIII da CF e o art. 404 da CLT só proíbem o trabalho noturno para menores de 16 anos.",
      ],
    ],
    id: "labor-q3-b-night-allowed",
    removed: [2],
  },
  {
    caseId: "fgv-oab-xv-labor-q3-pt",
    dependent: [],
    edits: [
      [
        "A) Não ocorreu prescrição total/bienal (extintiva), pois a mesma quando prestou serviços para a empresa era menor, e contra o menor não corre nenhum prazo de prescrição, nos termos do art. 440 da CLT e art. 198, I do CC. Sendo assim, entende-se que o prazo prescricional começa a correr somente quando atingir a maioridade (18 anos). Observa-se, que a mesma completou 18 anos no dia 5 de maio de 2013, não havendo assim a prescrição total. Então a ação não deve ser extinta, não merecendo ser acolhida a prescrição arguida pelo advogado da empresa ré.",
        "A) Ocorreu prescrição total/bienal (extintiva), pois a ação foi ajuizada mais de dois anos após a extinção do contrato, em 13 de setembro de 2011, e o prazo corre normalmente ainda que a empregada fosse menor, nos termos do art. 7º, XXIX da CF e art. 11 da CLT. Então a ação deve ser extinta, com resolução do mérito, acolhendo-se a prescrição arguida pela empresa ré.",
      ],
    ],
    id: "labor-q3-a-time-barred",
    removed: [0, 1],
  },
  {
    caseId: "fgv-oab-xv-labor-q4-pt",
    dependent: [],
    edits: [
      [
        "Pois o direito de provar um fato constitutivo é de quem o alega, nos termos do art. 818 da CLT e art. 333, I do CPC.\nComo o empregado alegou o fato constitutivo, tendo o empregador negado que a doença era decorrente do trabalho. Cabe então ao empregado provar o fato constitutivo do seu direito.",
        "Pois assim dispõem o art. 818 da CLT e o art. 333, I do CPC.",
      ],
    ],
    id: "labor-q4-no-constitutive-fact",
    removed: [1],
  },
  {
    caseId: "fgv-oab-xv-labor-q4-pt",
    dependent: [4],
    edits: [
      [
        "o meio pelo qual poderia ser provado tal fato era através da perícia pelo INSS. e nos termos do art. 21-A da lei 8213/91, por equiparar-se a acidente do trabalho.",
        "o meio pelo qual poderia ser provado tal fato era a prova testemunhal, ouvindo-se os colegas de trabalho do empregado.",
      ],
    ],
    id: "labor-q4-b-witnesses",
    removed: [3],
  },
  {
    caseId: "fgv-oab-xv-labor-q4-pt",
    dependent: [2],
    edits: [
      [
        "caberia ao empregado comprovar se a doença decorre ou não do trabalho. Pois o direito de provar um fato constitutivo é de quem o alega, nos termos do art. 818 da CLT e art. 333, I do CPC.\nComo o empregado alegou o fato constitutivo, tendo o empregador negado que a doença era decorrente do trabalho. Cabe então ao empregado provar o fato constitutivo do seu direito.",
        "caberia ao empregador comprovar que a doença não decorre do trabalho, pois é ele quem detém os meios de prova sobre as condições do ambiente de trabalho, nos termos do art. 818 da CLT e art. 333, II do CPC.",
      ],
    ],
    id: "labor-q4-a-employer-burden",
    removed: [0, 1],
  },
  {
    caseId: "fgv-oab-xvi-civil-q1-pt",
    dependent: [],
    edits: [
      [
        "Caso seja esta injusta poderá Mário alegar o tocante no 1519. C.C., suprimento judicial. ",
        "",
      ],
    ],
    id: "civil-q1-no-1519",
    removed: [3],
  },
  {
    caseId: "fgv-oab-xvi-civil-q1-pt",
    dependent: [],
    edits: [
      [
        "\nComo providência judicial poderá o casal, com base no artigo 1553 C.C. requerer a confirmação do casamento, após atingir Cristina idade núbil, com autorização de seus representantes legais, bem como caso necessário suprimento judicial.",
        "",
      ],
    ],
    id: "civil-q1-no-remedy",
    removed: [6, 7],
  },
  {
    caseId: "fgv-oab-xvi-civil-q1-pt",
    dependent: [1],
    edits: [
      [
        "No tocante a Cristina, 15 anos, será disposto no 1520 do C.C. autoriza esta a casar-se somente em caso de gravidez, por tratar-se de menor sem idade núbil consoante 1517 do C.C.",
        "No tocante a Cristina, 15 anos, já atingiu a idade núbil e, com o consentimento de seus pais, pode casar-se livremente, consoante 1517 do C.C.",
      ],
    ],
    id: "civil-q1-cristina-may-marry",
    removed: [0],
  },
  {
    caseId: "fgv-oab-xvi-civil-q2-pt",
    dependent: [],
    edits: [
      ["Uma vez que, conforme art. 2º do C.C. a lei põe a salvo", "Uma vez que a lei põe a salvo"],
      [
        "art. 2º do C.C. direitos garantidos ao nome do nascituro",
        "direitos garantidos ao nome do nascituro",
      ],
    ],
    id: "civil-q2-no-art2",
    removed: [1],
  },
  {
    caseId: "fgv-oab-xvi-civil-q2-pt",
    dependent: [3],
    edits: [
      [
        "legitimam Emília a representar o nascituro.",
        "legitimam Emília a agir quanto ao nascituro.",
      ],
      [
        "Tendo esta representação fundamento no art. 8º CPC, os incapazes serão assistidos/representados pelos seus pais. Sendo o nascituro um absolutamente incapaz ao teor do art. 3º C.C, I,. ",
        "",
      ],
    ],
    id: "civil-q2-no-representation",
    removed: [4],
  },
  {
    caseId: "fgv-oab-xvi-civil-q2-pt",
    dependent: [1],
    edits: [
      [
        "A) Sim, mesmo antes de nascer pode Emília reclamar os direitos do nascituro. Uma vez que, conforme art. 2º do C.C. a lei põe a salvo os direitos do nascituro desde a sua concepção, ainda que a personalidade civil comece com o nascimento com vida.",
        "A) Não. Antes do nascimento com vida não há direitos do nascituro a proteger, pois a personalidade civil só começa com o nascimento com vida, conforme art. 2º do C.C.",
      ],
    ],
    id: "civil-q2-no-unborn-rights",
    removed: [0],
  },
];

export function getAblationSource(ablation: Ablation) {
  const testCase = FGV_PUBLISHED_CASES.find(({ id }) => id === ablation.caseId);

  if (!testCase) {
    throw new Error(`No FGV case ${ablation.caseId}.`);
  }

  const text = ablation.edits.reduce((current, [from, to]) => {
    if (current.split(from).length !== 2) {
      throw new Error(`${ablation.id}: the edit must match its answer exactly once: ${from}`);
    }

    return current.replace(from, to);
  }, testCase.userInput.text);

  const aspects = testCase.userInput.basis.aspects;
  const official = testCase.expected?.officialTotal ?? 0;

  const lose = (indexes: number[]) =>
    indexes.reduce((sum, index) => sum + (aspects[index]?.points ?? 0), 0);

  const high = Number((official - lose(ablation.removed)).toFixed(2));
  const low = Number((high - lose(ablation.dependent)).toFixed(2));

  return { espelho: { high, low }, testCase, text };
}
