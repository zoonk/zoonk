import {
  cacd2024Essay1,
  cacd2024Essay2,
  cacd2024Essay3,
  cacd2024Essay4,
  cacd2024Essay5,
  cacd2024H11,
  cacd2024H12,
  cacd2024H13,
  cacd2024H14,
  cacd2024H15,
  cacd2024H21,
  cacd2024H22,
  cacd2024H23,
  cacd2024H24,
  cacd2024H25,
  cacd2024H31,
  cacd2024H32,
  cacd2024H33,
  cacd2024H34,
  cacd2024H35,
  cacd2024H41,
  cacd2024H42,
  cacd2024H43,
  cacd2024H44,
  cacd2024H45,
  cacd2024Translation1,
  cacd2024Translation2,
  cacd2024Translation3,
  cacd2024Translation4,
  cacd2024Translation5,
  cacd2024TranslationSource,
  cacd2025Essay1,
  cacd2025Essay2,
  cacd2025Essay3,
  cacd2025H11,
  cacd2025H12,
  cacd2025H13,
  cacd2025H14,
  cacd2025H22,
  cacd2025H23,
  cacd2025H31,
  cacd2025H32,
  cacd2025H33,
  cacd2025H34,
  cacd2025H41,
  cacd2025H42,
  cacd2025H43,
} from "./cebraspe-answers";
import {
  type GradeWritingExpected,
  type GradeWritingInput,
  type Grading,
  publishedCase,
  publishedQuestion,
} from "./shared";

const GUIDE = {
  2024: "https://guiasirbr.wordpress.com/wp-content/uploads/2025/06/guia_da_sarue_malabarista.pdf",
  2025: "https://drive.google.com/file/d/1iyvblAfecpqH2SSnKNP1NzOc2vntNiWK/view",
};

const NOTICE = {
  2024: "https://cdn.cebraspe.org.br/concursos/IRBR_24_DIPLOMACIA/arquivos/ED_1_IRBR_CACD_24_ABERTURA_ATUALIZADO_RET_2.PDF",
  2025: "https://cdn.cebraspe.org.br/concursos/IRBR_25_DIPLOMACIA/arquivos/Ed_1_IRBr_CACD_25_abertura_atualizado_ret_6_convertido.html",
};

type Year = keyof typeof GUIDE;
type Grid = [name: string, ...steps: string[]];
type Sections = Parameters<typeof publishedQuestion>[0]["sections"];

type Question = {
  context?: string;
  lines: number;
  title: string;
  question: string;
  sections: Sections;
};

const zeroing = (year: Year, section: number): Grading["zeroing"] =>
  (
    [
      ["blank", "Ausência de texto"],
      ["offTopic", "Fuga ao tema"],
      ["identification", "Marca identificadora na resposta"],
    ] as const
  ).map(([kind, text]) => ({
    citation: { passage: text, sourceId: `cacd-${year}-notice-6.8.${section}.1` },
    kinds: [kind],
    text,
  }));

function questionInput({
  year,
  key,
  text,
  question,
  noticeSection = 7,
  annex = 3,
}: {
  year: Year;
  key: string;
  text: string;
  question: Question;
  noticeSection?: number;
  annex?: number;
}): GradeWritingInput {
  const input = publishedQuestion({
    citation: {
      passage: `Anexo IV, item ${annex} e padrão definitivo`,
      sourceId: `cacd-${year}-standards`,
    },
    kind: "points",
    ...question,
    taskKey: `cacd-${year}-${key}`,
    text,
  });

  input.context = question.context ?? null;
  input.basis.grading.zeroing = zeroing(year, noticeSection);
  input.arithmetic = { rounding: null };
  return input;
}

function source(year: Year) {
  return {
    author: "Published candidate guide",
    board: "Cebraspe",
    notice: NOTICE[year],
    reference: GUIDE[year],
    scoreReference: GUIDE[year],
  };
}

// Adjacent differences preserve each displayed concept total, including centesimal marks.
function steps(
  name: string,
  totals: number[],
  requirements: string[],
): [string, ...[string, number][]] {
  return [
    name,
    ...requirements.map((requirement, index): [string, number] => [
      requirement,
      ((totals[index] ?? 0) - (totals[index - 1] ?? 0)) / 100,
    ]),
  ];
}

function sectionRows(rows: [string, ...[string, number][]][]): Sections {
  return rows.map(([name, ...aspects], index) => ({ aspects, id: `q${index + 1}`, name }));
}

function history2024(title: string, question: string, lines: 40 | 60, rows: Grid[]): Question {
  // The guide's partial marks are consistent with thirds. The public standard describes
  // the expected evidence, but does not specify the intermediate concept descriptors.
  const totals = lines === 60 ? [100, 200, 300] : [67, 133, 200];

  return {
    lines,
    question,
    sections: sectionRows(rows.map(([name, ...requirements]) => steps(name, totals, requirements))),
    title,
  };
}

// CACD 2024 definitive History standard, questions 1–4.
const WWI = history2024(
  "O Brasil e a Primeira Guerra Mundial",
  "Com referência ao Decreto nº 3.361, de 26 de outubro de 1917, discorra sobre o Brasil e a Primeira Guerra Mundial, abordando os dez aspectos a seguir.",
  60,
  [
    [
      "Neutralidade",
      "Situa a neutralidade brasileira no início da guerra",
      "Relaciona a neutralidade à posição diplomática de Lauro Müller ou à tradição pacifista",
      "Explica as razões políticas ou econômicas para manter a neutralidade",
    ],
    [
      "Paraná, Tijuca e Lapa",
      "Menciona o ataque alemão ao Paraná",
      "Identifica também o ataque ao Tijuca ou ao Lapa",
      "Identifica os ataques às três embarcações e sua repercussão para a neutralidade",
    ],
    [
      "Manifestações populares",
      "Identifica a reação popular aos ataques",
      "Situa manifestações ou atos contra interesses alemães",
      "Relaciona a mobilização popular à pressão para o governo abandonar a neutralidade",
    ],
    [
      "Debate intelectual",
      "Identifica posições divergentes na imprensa",
      "Distingue defensores dos Aliados e germanófilos",
      "Explica a posição neutrófila ou exemplifica o debate com intelectuais da época",
    ],
    [
      "Liga Brasileira pelos Aliados",
      "Menciona a Liga Brasileira pelos Aliados",
      "Identifica a defesa da causa aliada como objetivo da Liga",
      "Explica sua mobilização pública ou nomeia participantes pertinentes",
    ],
    [
      "Guerra submarina irrestrita",
      "Identifica a decisão alemã de adotar guerra submarina irrestrita em 1917",
      "Explica que a estratégia punha em risco navios de países neutros",
      "Relaciona os riscos a marinheiros e ao comércio brasileiro com o abandono da neutralidade",
    ],
    [
      "Entrada dos Estados Unidos",
      "Situa a entrada dos Estados Unidos na guerra em 1917",
      "Identifica o alinhamento político entre Brasil e Estados Unidos",
      "Explica como a entrada norte-americana pesou na decisão brasileira",
    ],
    [
      "Motivo imediato",
      "Identifica o torpedeamento do Macau",
      "Explica que o torpedeamento por submarino alemão foi o estopim da entrada",
      "Situa o episódio em outubro de 1917 e distingue o estopim dos demais fatores",
    ],
    [
      "Esforço aliado",
      "Identifica uma contribuição brasileira ao esforço aliado",
      "Descreve duas contribuições brasileiras, como missões naval e médica",
      "Explica o papel concreto de contribuições como a DNOG, a missão médica, a aviação ou os portos",
    ],
    [
      "Conferência da Paz",
      "Situa a participação brasileira na Conferência de Paris",
      "Identifica Epitácio Pessoa ou um resultado alcançado na conferência",
      "Explica os resultados negociados sobre navios, café retido na Alemanha ou a fundação da Liga",
    ],
  ],
);

const VARGAS = history2024(
  "Fim do Estado Novo e queremismo",
  "Discorra sobre o final do Estado Novo e o queremismo, abordando os dez aspectos a seguir.",
  60,
  [
    [
      "Diplomacia pendular",
      "Identifica a equidistância de Vargas",
      "Distingue a aproximação com Estados Unidos e Alemanha",
      "Explica a barganha nacionalista e seus objetivos econômico-militares",
    ],
    [
      "Crise dos submarinos",
      "Identifica os ataques submarinos alemães",
      "Relaciona os ataques à entrada do Brasil na guerra",
      "Contextualiza o rompimento com o Eixo, os ataques e o reconhecimento da beligerância em 1942",
    ],
    [
      "Contradição do regime",
      "Identifica a contradição entre ditadura interna e a posição aliada",
      "Explica a oposição internacional ao fascismo em contraste com o autoritarismo interno",
      "Relaciona a contradição ao desgaste do Estado Novo e à pressão por abertura",
    ],
    [
      "Lei Agamenon Magalhães",
      "Identifica a Lei Agamenon Magalhães no processo de abertura",
      "Explica seu objetivo imediato de organizar as eleições",
      "Relaciona suas regras eleitorais à experiência democrática posterior",
    ],
    [
      "Partidos nacionais",
      "Identifica o retorno do pluripartidarismo",
      "Explica a exigência de partidos nacionais",
      "Relaciona a exigência à reorganização das forças políticas no fim do Estado Novo",
    ],
    [
      "Bases partidárias",
      "Identifica PTB, PSD e UDN",
      "Distingue as bases varguistas das bases de oposição",
      "Caracteriza as bases dos três partidos e situa a legalização do PCB",
    ],
    [
      "Eleição presidencial",
      "Nomeia Eduardo Gomes e Eurico Gaspar Dutra",
      "Relaciona as candidaturas à UDN e ao PSD",
      "Explica o alinhamento das candidaturas frente ao legado varguista",
    ],
    [
      "Direitos trabalhistas",
      "Relaciona o queremismo à permanência de Vargas",
      "Associa a mobilização à defesa dos direitos trabalhistas",
      "Situa a CLT e explica por que seus beneficiários apoiavam a permanência de Vargas",
    ],
    [
      "DIP",
      "Identifica o Departamento de Imprensa e Propaganda",
      "Explica seu papel na legitimação do Estado Novo",
      "Descreve a aproximação do aparato de propaganda com a mobilização queremista",
    ],
    [
      "Deposição",
      "Identifica a deposição de Vargas em 1945",
      "Explica a atuação militar ou o temor de continuísmo",
      "Relaciona a deposição à transição e à vitória eleitoral de Dutra",
    ],
  ],
);

const MODERNISM = history2024(
  "Semana de Arte Moderna e modernismos",
  "Discorra sobre a cidade de São Paulo na década de 1920, a Semana de Arte Moderna de 1922 e os modernismos no Brasil da Primeira República.",
  40,
  [
    [
      "Contexto social",
      "Identifica transformações sociais em São Paulo nos anos 1920",
      "Relaciona essas transformações à expansão cafeeira, à imigração ou à industrialização",
      "Explica a relação entre urbanização, novos grupos sociais e o patrocínio às artes",
    ],
    [
      "Contexto intelectual",
      "Menciona a efervescência intelectual de São Paulo",
      "Apresenta um debate, instituição ou rede intelectual pertinente",
      "Relaciona ideias de modernidade e identidade nacional às transformações da cidade",
    ],
    [
      "Contexto artístico",
      "Caracteriza a renovação artística paulista anterior a 1922",
      "Identifica antecedentes ou artistas dessa renovação",
      "Explica a tensão entre a experimentação artística e os padrões acadêmicos",
    ],
    [
      "Características da Semana",
      "Identifica a Semana de 1922",
      "Situa o evento no Teatro Municipal de São Paulo ou no centenário da Independência",
      "Descreve sua programação artística ou a recepção pública do evento",
    ],
    [
      "Temáticas da Semana",
      "Identifica um tema presente na Semana",
      "Relaciona a temática à sociedade, à modernidade ou à identidade brasileira",
      "Explica como temas locais dialogavam com as vanguardas",
    ],
    [
      "Propostas artísticas",
      "Identifica a ruptura com convenções acadêmicas",
      "Dá exemplo concreto de inovação formal, estética ou linguística",
      "Explica como as propostas combinaram experimentação e preocupação com a expressão brasileira",
    ],
    [
      "Participantes",
      "Identifica um participante da Semana",
      "Identifica participantes de expressões artísticas distintas",
      "Explica contribuições concretas dos participantes citados",
    ],
    [
      "Outros modernismos",
      "Reconhece a existência de modernismos além da Semana",
      "Dá exemplo regional ou temporal de outro modernismo",
      "Explica o que a pluralidade de modernismos revela sobre os limites de centrar a história em São Paulo",
    ],
    [
      "Revista Klaxon",
      "Identifica a revista Klaxon",
      "Descreve sua relação com a divulgação de propostas modernistas",
      "Explica um aspecto de sua inovação editorial ou de seu legado",
    ],
    [
      "Desdobramentos",
      "Identifica um desdobramento da Semana",
      "Descreve um movimento, manifesto ou publicação posterior",
      "Relaciona o legado modernista a novas vertentes ou a outras formas de produção cultural",
    ],
  ],
);

const JK = history2024(
  "Plano de Metas do governo Juscelino Kubitschek",
  "Discorra sobre a política econômica do governo Juscelino Kubitschek, o Plano de Metas e seus impactos econômicos e sociais.",
  40,
  [
    [
      "Desenvolvimentismo",
      "Identifica o compromisso desenvolvimentista de JK",
      "Explica a importância do planejamento ou do investimento estatal",
      "Relaciona planejamento, industrialização e lançamento do Plano de Metas",
    ],
    [
      "Setores prioritários",
      "Caracteriza o Plano de Metas como conjunto de metas de desenvolvimento",
      "Identifica pelo menos três dos setores prioritários",
      "Identifica energia, transporte, alimentação, indústria de base e educação",
    ],
    [
      "Educação",
      "Situa a educação no Plano de Metas",
      "Explica o vínculo entre educação e formação de mão de obra",
      "Caracteriza a prioridade limitada da educação e distingue os objetivos educacionais pertinentes",
    ],
    [
      "Brasília",
      "Identifica a construção de Brasília como meta-síntese",
      "Menciona a previsão constitucional da transferência",
      "Relaciona o projeto executado por JK às previsões constitucionais anteriores",
    ],
    [
      "Interiorização",
      "Relaciona Brasília à interiorização da capital",
      "Explica a integração territorial impulsionada pela mudança",
      "Relaciona infraestrutura e ocupação do interior ao combate às desigualdades regionais",
    ],
    [
      "Financiamento público",
      "Identifica a participação do Estado no financiamento",
      "Identifica fonte pública, como fundos vinculados ou recursos orçamentários",
      "Relaciona as fontes públicas a aplicações em energia, transporte ou indústrias de base",
    ],
    [
      "Capital privado e estrangeiro",
      "Identifica o papel do capital privado ou estrangeiro",
      "Explica um incentivo ao investimento privado ou estrangeiro",
      "Relaciona os incentivos ao desenvolvimento industrial, em especial o automobilístico",
    ],
    [
      "Inflação e dívida",
      "Identifica o aumento da inflação ou da dívida externa",
      "Identifica ambos os efeitos",
      "Relaciona a emissão monetária ou o crédito externo ao financiamento do desenvolvimento",
    ],
    [
      "Plano de Estabilização Monetária",
      "Identifica o PEM",
      "Explica o objetivo de conter a inflação e estabilizar as contas",
      "Explica o abandono do PEM em favor da continuidade do Plano de Metas",
    ],
    [
      "FMI",
      "Identifica as negociações com o FMI",
      "Explica as condições para a concessão de financiamento",
      "Relaciona a rejeição das condições ao rompimento com o FMI em 1959",
    ],
  ],
);

// The 2025 standard describes the content. The guide shows exact marks for Q1's
// 9.33 answer and the post-appeal 4-point maximum for its sixth quesito.
const LEAGUE: Question = {
  lines: 60,
  question:
    "Considerando o artigo 1º do Pacto da Liga das Nações, disserte sobre a participação do Brasil como membro originário da organização.",
  sections: sectionRows([
    steps(
      "Brasil na Primeira Guerra",
      [200, 400],
      [
        "Explica a participação do Brasil na guerra e sua passagem da neutralidade à beligerância",
        "Explica a posição brasileira ao final do conflito e a busca por reconhecimento ou recompensa",
      ],
    ),
    steps(
      "Conferência da Paz de 1919",
      [133, 267, 400],
      [
        "Situa a participação brasileira na Conferência da Paz",
        "Explica a defesa dos direitos das potências menores ou a busca de projeção internacional",
        "Articula a defesa das potências menores com a aspiração brasileira a um status de grande potência",
      ],
    ),
    steps(
      "Apoio dos Estados Unidos",
      [200, 400],
      [
        "Explica a cooperação ou troca de apoio entre as delegações brasileira e norte-americana",
        "Identifica interesses ou contrapartidas concretos, como os navios alemães ou a indicação para o Conselho",
      ],
    ),
    steps(
      "Atuação da diplomacia",
      [300, 600],
      [
        "Explica uma atuação brasileira na Liga, como a representação continental, a Corte Permanente ou a ampliação do Conselho",
        "Explica uma segunda atuação brasileira distinta na Liga",
      ],
    ),
    steps(
      "Assento permanente",
      [133, 267, 400],
      [
        "Identifica o objetivo brasileiro de obter um assento permanente",
        "Relaciona o pleito ao governo Artur Bernardes ou descreve uma iniciativa para conquistar o assento",
        "Distingue estratégias sucessivas, como a fórmula Brasil–Espanha, a suplência dos EUA e o reconhecimento por serviços",
      ],
    ),
    steps(
      "Opinião pública",
      [133, 267, 400],
      [
        "Caracteriza o interesse ou o debate público brasileiro sobre a Liga",
        "Explica o debate crítico fomentado pela imprensa a partir de 1925, com exemplo pertinente",
        "Explica uma resposta do governo, como propaganda nas escolas, conferências ou seção especial no Itamaraty",
      ],
    ),
    steps(
      "Retirada da Liga",
      [133, 267, 400],
      [
        "Situa a retirada brasileira da Liga em 1926",
        "Relaciona Locarno ou a admissão alemã à controvérsia no Conselho",
        "Explica o encadeamento entre Locarno, a disputa sobre assentos permanentes, o veto e a retirada do Brasil",
      ],
    ),
  ]),
  title: "O Brasil na Liga das Nações",
};

// For the full-credit anchors, the standard supports the topics and criterion
// ceilings. The equal atom split does not assert unpublished intermediate marks.
const SLAVERY: Question = {
  lines: 60,
  question:
    "Discorra sobre a questão escrava no Brasil ao longo do período imperial, abordando as formas e os usos do trabalho escravo, a extinção do tráfico, as revoltas e o movimento abolicionista.",
  sections: sectionRows([
    steps(
      "Formas e usos do trabalho escravo",
      [250, 500, 750, 1000],
      [
        "Descreve o trabalho escravo nas lavouras do Brasil imperial",
        "Descreve formas de trabalho escravo nas cidades, incluindo os escravizados de ganho",
        "Explica o trabalho doméstico escravo",
        "Explica formas de manumissão e as relaciona aos diferentes usos do trabalho escravo",
      ],
    ),
    steps(
      "Política de extinção do tráfico",
      [250, 500, 750, 1000],
      [
        "Explica a pressão britânica pela extinção do tráfico",
        "Explica a Lei de 1831 e seu cumprimento limitado",
        "Explica medidas intermediárias como o projeto Barbacena ou o Bill Aberdeen",
        "Explica a Lei Eusébio de Queirós e a continuidade da escravidão após o fim do tráfico",
      ],
    ),
    steps(
      "Revoltas e abolicionismo",
      [250, 500, 750, 1000],
      [
        "Reconhece a agência de escravizados em revoltas",
        "Descreve revoltas pertinentes como a dos Malês, a Cabanada ou a Balaiada",
        "Explica a atuação de abolicionistas como Luiz Gama e José do Patrocínio",
        "Relaciona associações ou imprensa abolicionista à formação de uma opinião pública favorável à abolição",
      ],
    ),
  ]),
  title: "A questão escrava no Brasil imperial",
};

const INDEPENDENCE: Question = {
  lines: 40,
  question:
    "Discorra sobre o processo de independência do Brasil, consideradas as fases de ruptura com Portugal e dois fatos de cada dimensão: político-jurídica, militar e diplomática.",
  sections: sectionRows([
    steps(
      "Fases da ruptura",
      [67, 133, 200],
      [
        "Distingue duas fases do rompimento com Portugal",
        "Caracteriza a fase nacionalista associada a José Bonifácio",
        "Explica a fase contrarrevolucionária subsequente, incluindo a dissolução da Constituinte ou a reação ao autoritarismo",
      ],
    ),
    ...(
      [
        [
          "Político-jurídica",
          "a convocação da Constituinte, a imposição do cumpra-se ou a criação dos ministérios",
        ],
        [
          "Militar",
          "as campanhas da Independência, a criação das forças armadas nacionais ou o recrutamento de forças",
        ],
        [
          "Diplomática",
          "o Manifesto às Nações Amigas, as instruções a negociadores ou as negociações de reconhecimento",
        ],
      ] as const
    ).map(([name, examples]) =>
      steps(
        name,
        [200, 400, 600],
        [
          `Identifica um fato da dimensão ${name.toLowerCase()}, como ${examples}`,
          `Explica como o fato contribuiu para o rompimento na dimensão ${name.toLowerCase()}`,
          `Explica um segundo fato distinto na dimensão ${name.toLowerCase()}`,
        ],
      ),
    ),
  ]),
  title: "Dimensões da independência do Brasil",
};

const ESTADO_NOVO: Question = {
  lines: 40,
  question:
    "Discorra sobre o Departamento de Imprensa e Propaganda no Estado Novo, a cultura, a identidade nacional e a política da boa vizinhança.",
  sections: sectionRows([
    steps(
      "Valorização da cultura popular",
      [200, 400, 600],
      [
        "Explica a valorização de estilos musicais populares como o samba",
        "Relaciona carnaval ou rádio à difusão de uma cultura de massas",
        "Explica o papel do DIP e de compositores ou agentes culturais nesse processo",
      ],
    ),
    steps(
      "Representações nacionais",
      [233, 467, 700],
      [
        "Explica o tratamento da cultura como assunto de Estado",
        "Identifica intelectuais, artistas ou obras que contribuíram para a construção da nacionalidade",
        "Explica como a mistura de tradições populares e regionais foi valorizada como identidade nacional",
      ],
    ),
    steps(
      "Boa vizinhança e cinema",
      [233, 467, 700],
      [
        "Relaciona a política de boa vizinhança de Roosevelt ao pan-americanismo",
        "Explica o papel do cinema na aproximação entre os países",
        "Apresenta exemplo pertinente, como Zé Carioca ou Alô, Amigos, e explica seu efeito na imagem do Brasil",
      ],
    ),
  ]),
  title: "Cultura no Estado Novo e a política da boa vizinhança",
};

const indexes = (length: number) => Array.from({ length }, (_, index) => index);

// CACD 2024 Ed. 8 §1.1 and CACD 2025 Ed. 12 §3.1 publish the aggregate phase scores.
function passBoundary(otherAnswers: number | null): GradeWritingExpected["passBoundary"] {
  return otherAnswers === null ? undefined : { otherAnswers, sectionMinimum: 480 };
}

function historyCase(
  year: Year,
  questionNumber: number,
  question: Question,
  answer: number,
  text: string,
  total: number,
  otherAnswers: number | null,
  marks?: readonly (number | "partial" | null)[],
) {
  const key = `history-q${questionNumber}`;
  const userInput = questionInput({ key, question, text, year });
  const earned: number[] = [];
  const uncertain: number[] = [];
  let offset = 0;

  for (const [sectionIndex, section] of question.sections.entries()) {
    const mark = marks ? marks[sectionIndex] : section.aspects.length;

    for (const index of indexes(section.aspects.length)) {
      if (mark === null || (mark === "partial" && index < section.aspects.length - 1)) {
        uncertain.push(offset + index);
      } else if (typeof mark === "number" && index < mark) {
        earned.push(offset + index);
      }
    }

    offset += section.aspects.length;
  }

  return publishedCase({
    expected: {
      earned,
      officialContent: total,
      officialTotal: total,
      passBoundary: passBoundary(otherAnswers),
      uncertain,
    },
    id: `cebraspe-cacd-${year}-${key}-${answer}`,
    source: source(year),
    userInput,
  });
}

const HISTORY_CASES = [
  historyCase(2024, 1, WWI, 1, cacd2024H11, 30, 663.08),
  historyCase(2024, 1, WWI, 2, cacd2024H12, 29, 635.3, [3, 3, 3, 3, 3, 3, 3, 2, 3, 3]),
  historyCase(2024, 1, WWI, 3, cacd2024H13, 29, 659.27, [3, 3, 3, 3, 3, 3, 3, 2, 3, 3]),
  historyCase(2024, 1, WWI, 4, cacd2024H14, 25, 640.72, [3, 3, 2, 2, 2, 3, 2, 3, 3, 2]),
  historyCase(2024, 1, WWI, 5, cacd2024H15, 21, null, [
    "partial",
    3,
    "partial",
    3,
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
  ]),
  historyCase(2024, 2, VARGAS, 1, cacd2024H21, 30, 658.27),
  historyCase(2024, 2, VARGAS, 2, cacd2024H22, 30, 664.51),
  historyCase(2024, 2, VARGAS, 3, cacd2024H23, 30, 644.44),
  historyCase(2024, 2, VARGAS, 4, cacd2024H24, 25, 656.43, [3, 3, 2, 2, 3, 3, 2, 2, 2, 3]),
  historyCase(2024, 2, VARGAS, 5, cacd2024H25, 20, null, [
    3,
    3,
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
    "partial",
  ]),
  historyCase(2024, 3, MODERNISM, 1, cacd2024H31, 20, 681.79),
  historyCase(2024, 3, MODERNISM, 2, cacd2024H32, 20, 672.62),
  historyCase(2024, 3, MODERNISM, 3, cacd2024H33, 20, 677.14),
  historyCase(2024, 3, MODERNISM, 4, cacd2024H34, 17.32, 685.45, [3, 3, 2, 3, 3, 2, 3, 2, 3, 2]),
  historyCase(
    2024,
    3,
    MODERNISM,
    5,
    cacd2024H35,
    8,
    null,
    MODERNISM.sections.map(() => "partial" as const),
  ),
  historyCase(2024, 4, JK, 1, cacd2024H41, 20, 676.62),
  historyCase(2024, 4, JK, 2, cacd2024H42, 20, 661.93),
  historyCase(2024, 4, JK, 3, cacd2024H43, 20, 686.77),
  historyCase(2024, 4, JK, 4, cacd2024H44, 19.33, 682.46, [3, 3, 3, 3, 3, 2, 3, 3, 3, 3]),
  historyCase(2024, 4, JK, 5, cacd2024H45, 15.31, null, [2, 2, 2, 3, 3, 2, 3, 2, 2, 2]),
  historyCase(2025, 1, LEAGUE, 1, cacd2025H11, 30, 675.47),
  historyCase(2025, 1, LEAGUE, 2, cacd2025H12, 30, 666.88),
  historyCase(
    2025,
    1,
    LEAGUE,
    3,
    cacd2025H13,
    23.01,
    707.59,
    LEAGUE.sections.map(() => null),
  ),
  historyCase(2025, 1, LEAGUE, 4, cacd2025H14, 9.33, null, [1, 1, 1, 0, 1, 2, 0]),
  historyCase(2025, 2, SLAVERY, 2, cacd2025H22, 30, 699.91),
  historyCase(2025, 2, SLAVERY, 3, cacd2025H23, 30, 680.27),
  historyCase(2025, 3, INDEPENDENCE, 1, cacd2025H31, 20, 703.29),
  historyCase(2025, 3, INDEPENDENCE, 2, cacd2025H32, 19.33, 708.42, [2, 3, 3, 3]),
  historyCase(2025, 3, INDEPENDENCE, 3, cacd2025H33, 15.33, 680.43, [2, null, null, null]),
  historyCase(2025, 3, INDEPENDENCE, 4, cacd2025H34, 8.67, null, [1, null, null, null]),
  historyCase(2025, 4, ESTADO_NOVO, 1, cacd2025H41, 20, 698.84),
  historyCase(2025, 4, ESTADO_NOVO, 2, cacd2025H42, 20, 720.42),
  historyCase(2025, 4, ESTADO_NOVO, 3, cacd2025H43, 20, 712.82),
];

const PRESENTATION = steps(
  "Apresentação textual",
  [300, 600, 1000],
  [
    "Apresenta uma tese coerente sobre o tema",
    "Organiza o texto com progressão entre parágrafos e conclusão",
    "Mantém clareza, coesão e estilo apropriados ao longo da redação",
  ],
);

const ARGUMENT = steps(
  "Capacidade de argumentação",
  [200, 500, 700, 1000],
  [
    "Formula argumentos pertinentes à tese",
    "Sustenta os argumentos com exemplos ou referências pertinentes",
    "Relaciona os exemplos aos pontos da tese que eles sustentam",
    "Sistematiza argumentos objetivos, relevantes e consistentes ao longo da redação",
  ],
);

function languageAllowance(points: number): [string, ...[string, number][]] {
  // Production subtracts every error from a single total. The baseline is unconditional
  // for an assessable response so deductions initially come from the board's language share.
  return [
    "Base de correção gramatical e propriedade da linguagem",
    [
      "Concede a base de linguagem a qualquer resposta avaliável, mesmo que contenha erros. Cite qualquer trecho da resposta para registrar essa base antes das deduções.",
      points,
    ],
  ];
}

const ESSAY_2024: Question = {
  lines: 70,
  question:
    "Com base nas preocupações ambientais expressas por José Bonifácio entre 1815 e 1828, discorra sobre a atualidade de suas ideias à luz das mudanças climáticas e do desmatamento no Brasil e no mundo. Considere a responsabilidade da diplomacia brasileira diante da COP30 na Amazônia.",
  sections: sectionRows([
    PRESENTATION,
    ARGUMENT,
    steps(
      "Capacidade de análise e reflexão",
      [500, 1000, 1500, 2000, 2500],
      [
        "Explica as preocupações de José Bonifácio com os efeitos ambientais do desmatamento",
        "Relaciona essas preocupações aos problemas contemporâneos do Brasil, com análise de causas e consequências",
        "Insere os problemas brasileiros no contexto das mudanças climáticas e da agenda ambiental global",
        "Examina a trajetória ou a responsabilidade da diplomacia ambiental brasileira com exemplos concretos",
        "Analisa a oportunidade ou os limites da COP30 na Amazônia diante dos desafios levantados no próprio texto",
      ],
    ),
    languageAllowance(25),
  ]),
  title: "Atualidade do pensamento ambiental de José Bonifácio",
};

const ESSAY_2025: Question = {
  lines: 70,
  question:
    "Redija um texto dissertativo sobre a arte e a diplomacia na interpretação e na humanização das fronteiras do mundo.",
  sections: sectionRows([
    PRESENTATION,
    ARGUMENT,
    steps(
      "Capacidade de análise e reflexão",
      [500, 1000, 1500, 2000, 2500],
      [
        "Estabelece uma relação entre arte, diplomacia e interpretação da realidade",
        "Discute como uma ou mais manifestações artísticas podem humanizar fronteiras",
        "Relaciona o tema à ação diplomática e a situações concretas no mundo contemporâneo",
        "Analisa possibilidades ou limites da arte como instrumento de influência ou diálogo",
        "Desenvolve reflexão própria sobre as relações entre o plano interno e o externo ou sobre a transformação de fronteiras de separação em cooperação",
      ],
    ),
    languageAllowance(25),
  ]),
  title: "Arte e diplomacia na interpretação e na humanização das fronteiras",
};

const TRANSLATION: Question = {
  context: cacd2024TranslationSource,
  lines: 30,
  question: "Translate the text presented above into Portuguese.",
  sections: sectionRows([
    steps(
      "Fidelidade ao texto original",
      [300, 600, 900, 1200, 1500],
      [
        "Preserva o sentido da primeira pergunta e a descrição da rotina de trabalho do pai",
        "Preserva o relato sobre escrever à mão, datilografar, revisar e contratar um profissional",
        "Preserva a comparação entre computador, pensamento e máquina de escrever",
        "Preserva o relato sobre o material não impresso, as revisões, os lembretes e o travamento",
        "Preserva a segunda pergunta e a resposta sobre trabalhar com outras pessoas e reconciliar-se com os fantasmas",
      ],
    ),
    languageAllowance(15),
  ]),
  title: "Tradução de entrevista com Ian McEwan",
};

function languageCase({
  content,
  errors,
  key,
  order,
  otherAnswers,
  question,
  text,
  total,
  year,
}: {
  content: number;
  errors: number;
  key: "essay" | "translation";
  order: number;
  otherAnswers: number | null;
  question: Question;
  text: string;
  total: number;
  year: Year;
}) {
  const essay = key === "essay";

  const userInput = questionInput({
    annex: essay ? 1 : 2,
    key,
    noticeSection: essay ? 5 : 6,
    question,
    text,
    year,
  });

  const formula = essay ? "max(0, 25 − 0,5 × NE)" : "max(0, 15 − 0,5 × NE)";

  userInput.basis.grading.language = {
    citation: { passage: formula, sourceId: `cacd-${year}-notice-annex-iv-${essay ? 1 : 2}` },
    factor: 0.5,
    formula,
    method: "perError",
    text: "Deduzir 0,50 ponto por erro de correção gramatical ou propriedade da linguagem.",
  };

  const baseline = userInput.basis.aspects.length - 1;
  const fullContent = content === (essay ? 45 : 15);

  const expected: Partial<GradeWritingExpected> = {
    earned: fullContent ? indexes(baseline + 1) : [baseline],
    officialContent: content + (essay ? 25 : 15),
    officialErrorCount: errors,
    officialTotal: total,
    passBoundary: passBoundary(otherAnswers),
    uncertain: fullContent ? [] : indexes(baseline),
  };

  return publishedCase({
    expected,
    id: `cebraspe-cacd-${year}-${key}-${order}`,
    source: source(year),
    userInput,
  });
}

const LANGUAGE_CASES = [
  ...(
    [
      [2024, ESSAY_2024, cacd2024Essay1, 45, 0, 70, 612.71],
      [2024, ESSAY_2024, cacd2024Essay2, 45, 1, 69.5, 633.76],
      [2024, ESSAY_2024, cacd2024Essay3, 45, 1, 69.5, 633.48],
      [2024, ESSAY_2024, cacd2024Essay4, 45, 10, 65, 641.9],
      [2024, ESSAY_2024, cacd2024Essay5, 31, 4, 54, null],
      [2025, ESSAY_2025, cacd2025Essay1, 45, 0, 70, 656.44],
      [2025, ESSAY_2025, cacd2025Essay2, 45, 0, 70, 655.72],
      [2025, ESSAY_2025, cacd2025Essay3, 45, 5, 67.5, 653.08],
    ] as const
  ).map(([year, question, text, content, errors, total, otherAnswers], index) =>
    languageCase({
      content,
      errors,
      key: "essay",
      order: index < 5 ? index + 1 : index - 4,
      otherAnswers,
      question,
      text,
      total,
      year,
    }),
  ),
  ...(
    [
      [cacd2024Translation1, 15, 0, 30, 664.3],
      [cacd2024Translation2, 15, 0, 30, 672.77],
      [cacd2024Translation3, 15, 0, 30, 686.76],
      [cacd2024Translation4, 15, 6, 27, 673.89],
      [cacd2024Translation5, 9, 15, 16.5, null],
    ] as const
  ).map(([text, content, errors, total, otherAnswers], index) =>
    languageCase({
      content,
      errors,
      key: "translation",
      order: index + 1,
      otherAnswers,
      question: TRANSLATION,
      text,
      total,
      year: 2024,
    }),
  ),
];

export const CEBRASPE_PUBLISHED_CASES = [...HISTORY_CASES, ...LANGUAGE_CASES];
