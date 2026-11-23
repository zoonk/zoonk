import { cguWritingGrading } from "../_fixtures/cgu-writing-grading";
import { CEBRASPE_PUBLISHED_CASES } from "./cases/cebraspe-published";
import { ENEM_PUBLISHED_CASES } from "./cases/enem-published";
import { FGV_PUBLISHED_CASES } from "./cases/fgv-published";
import {
  type Arithmetic,
  type Basis,
  type GradeWritingExpected,
  type GradeWritingInput,
  type Grading,
  type WritingCase,
  type ZeroKind,
  basis,
  points,
  publishedCase,
  publishedQuestion,
} from "./cases/shared";
import {
  ENEM_ZERO_ANSWERS,
  EN_ANSWERS,
  GEMINI_ANSWERS,
  INEP_REDACOES,
  LEVELS_ANSWERS,
  OPENAI_ANSWERS,
  POINTS_ANSWERS,
} from "./essays";

/** NQ1 and NQ2 as the CGU 2026 notice states them; no rounding, zero for fuga ao tema. */
const CGU_NOTICE =
  "https://cdn.cebraspe.org.br/concursos/CGU_26_AFFC/arquivos/90B861E07F72AFB1ECB1B3AE8974443779FFF17388907D1F7F5FDB621761295F.html";

const MPO_STANDARD =
  "https://cdn.cebraspe.org.br/concursos/mpo_24/arquivos/PADRO_DEFINITIVO_DE_RESPOSTA_CARGO_1_PROVA_DISCURSIVA_P4.PDF";

const INEP_GUIDE =
  "https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/a_redacao_no_enem_2025_cartilha_do_participante.pdf";

const OAB_NOTICE = "https://oab.fgv.br/arq/649/604111_46%20eou.%20edital%20de%20abertura..pdf";

const OAB_STANDARD =
  "https://oab.fgv.br/arq/649/410537_OAB%2046%20-%20PADR%C3%83O%20DE%20RESPOSTA%20-%20B002%20-%20DIREITO%20CIVIL.pdf";

const CEBRASPE_ARITHMETIC: Arithmetic = { rounding: null, zeroRules: [0] };

/**
 * Built from Cebraspe's published definitive answer standard for MPO 2024, Cargo 1, Prova
 * Discursiva P4 (Questão), with its three quesitos, on the CGU 2026 notice's 30-line, 30-point
 * question. Each quesito's concept steps become all-or-nothing aspects.
 */
const PLANO_REAL_QUESTION = `Redija um texto dissertativo acerca da estabilização da economia brasileira a partir do Plano Real. Ao elaborar seu texto, atenda ao que se pede a seguir.
1 Relacione o combate ao déficit público ao controle da inflação nos períodos anterior e posterior à implantação do Plano Real. [valor: 9,00 pontos]
2 Diferencie os instrumentos heterodoxos dos instrumentos ortodoxos de combate à inflação. [valor: 9,00 pontos]
3 Explique as três etapas do Plano Real. [valor: 9,00 pontos]`;

const PLANO_REAL_KEY_POINTS = [
  "Os planos anteriores ao Real (Cruzado, Bresser, Verão, Collor 1 e 2) se baseavam em congelamentos e âncoras e fracassaram sem atacar o déficit público",
  "Após o Real, o fim do imposto inflacionário expôs o déficit; vieram o superávit primário do tripé (1999) e a Lei de Responsabilidade Fiscal (2000)",
  "Heterodoxos: controle direto dos preços (congelamento de preços, de tarifas e de câmbio)",
  "Ortodoxos: controle indireto, pelo nível de atividade (alta dos juros, que reduz o consumo)",
  "Etapas: ajuste fiscal (PAI, 1993; FSE, 1994); URV (março de 1994) contra a inércia; real (1º de julho de 1994) com paridade cambial e regras de emissão",
];

const PLANO_REAL_BASIS = basis({
  aspects: points([
    [
      "Apresentação e estrutura textual: texto dissertativo em parágrafos, com introdução, desenvolvimento e conclusão",
      3,
    ],
    [
      "Período anterior ao Real: os planos de estabilização anteriores fracassaram por não enfrentarem o déficit público",
      4.5,
    ],
    [
      "Período posterior ao Real: o déficit ficou exposto e exigiu controle fiscal (superávit primário, Lei de Responsabilidade Fiscal)",
      4.5,
    ],
    [
      "Instrumentos heterodoxos: atuam diretamente sobre os preços, por congelamentos de preços, tarifas ou câmbio",
      4.5,
    ],
    [
      "Instrumentos ortodoxos: atuam indiretamente, pelo nível de atividade, como a alta dos juros",
      4.5,
    ],
    [
      "Primeira etapa: ajuste fiscal com o Programa de Ação Imediata e o Fundo Social de Emergência",
      3,
    ],
    ["Segunda etapa: a Unidade Real de Valor, em março de 1994, contra a inércia inflacionária", 3],
    [
      "Terceira etapa: a nova moeda, o real, em julho de 1994, com paridade cambial e limites à emissão",
      3,
    ],
  ]),
  criteria: [{ id: "content", name: "Domínio do conteúdo", points: 30 }],
  grading: cguWritingGrading({
    factor: 6,
    formula: "NQ1 = NC - 6 × NE ÷ TL",
    item: "9.7.5",
    total: 30,
  }),
  lines: 30,
  taskKey: "cgu-question-30",
  title: "Plano Real e déficit público",
  total: 30,
});

/**
 * Built from Cebraspe's published definitive answer standard for MPO 2024, Cargo 1, Prova
 * Discursiva P4 (Dissertação), with its five quesitos, on the CGU 2026 notice's 60-line, 70-point
 * question.
 */
const IMPACT_QUESTION = `Redija um texto dissertativo acerca da avaliação de impacto de políticas públicas e de programas sociais. Ao elaborar seu texto, aborde os seguintes aspectos:
1 por que, para que e quando fazer a avaliação de impacto; [valor: 18,00 pontos]
2 a relação do impacto com o contexto socioeconômico e com as características do público-alvo, a interação entre o impacto de diferentes programas, a comparação entre impacto potencial e impacto efetivo e a avaliação de impacto como método de monitoramento; [valor: 15,00 pontos]
3 a importância da avaliação de impacto para o uso interno pela administração pública; [valor: 8,00 pontos]
4 a importância da avaliação de impacto para o uso externo, por entidades como o Poder Legislativo, os órgãos de controle e a comunidade acadêmica; [valor: 8,00 pontos]
5 os métodos de avaliação, as abordagens ex ante e ex post e três momentos da execução em que a avaliação é pertinente. [valor: 14,00 pontos]`;

const IMPACT_KEY_POINTS = [
  "Por que: recursos escassos e decisões baseadas em evidências; para que: aprimorar, prestar contas e subsidiar novas políticas; quando: ao longo de todo o ciclo",
  "Contexto socioeconômico e características do público-alvo condicionam os efeitos; comparar impacto potencial e efetivo; avaliação como monitoramento contínuo",
  "Uso interno: refinar o planejamento e a gestão e corrigir rumos durante a execução",
  "Uso externo: Legislativo e órgãos de controle; academia e políticas semelhantes",
  "Métodos (experimentos aleatorizados, regressão, pareamento); ex ante (projeções, custo-benefício) e ex post (resultados efetivos); antes, durante e depois da execução",
];

const IMPACT_BASIS = basis({
  aspects: points([
    [
      "Apresentação e estrutura textual: texto dissertativo em parágrafos, com introdução, desenvolvimento e conclusão",
      7,
    ],
    ["Por que avaliar, com justificativa coerente", 6],
    ["Para que avaliar, com justificativa coerente", 6],
    ["Quando avaliar, com justificativa coerente", 6],
    ["Relação do impacto com o contexto socioeconômico", 3],
    ["Relação do impacto com as características do público-alvo", 3],
    ["Comparação entre impacto potencial e impacto efetivo", 3],
    ["Avaliação de impacto como método de monitoramento", 3],
    ["Interação entre o impacto de diferentes programas ou políticas", 3],
    ["Uso interno: refinar o planejamento e a gestão", 4],
    ["Uso interno: corrigir rumos durante a execução", 4],
    ["Uso externo: Poder Legislativo e órgãos de controle", 4],
    ["Uso externo: comunidade acadêmica e políticas semelhantes", 4],
    ["Métodos de avaliação de impacto", 2],
    ["Abordagem ex ante", 3],
    ["Abordagem ex post", 3],
    ["Primeiro momento: antes da implementação", 2],
    ["Segundo momento: durante a execução", 2],
    ["Terceiro momento: após a conclusão", 2],
  ]),
  criteria: [{ id: "content", name: "Domínio do conteúdo", points: 70 }],
  grading: cguWritingGrading({
    factor: 14,
    formula: "NQ2 = NC – 14 × NE ÷ TL",
    item: "9.7.6",
    total: 70,
  }),
  lines: 60,
  taskKey: "cgu-case-60",
  title: "Avaliação de impacto de políticas",
  total: 70,
});

const ENEM_LEVELS: Grading = {
  criteria: [],
  kind: "enem",
  language: null,
  rounding: null,
  zeroing: [
    {
      citation: {
        passage:
          "14.7 A banca avaliadora poderá atribuir nota 0 (zero) à redação que: 14.7.1 Não atender à proposta solicitada ou possua outra estrutura textual que não seja a estrutura dissertativo-argumentativa",
        sourceId: "enem-2026-edital-64",
      },
      kinds: ["offTopic", "wrongForm"],
      text: "Fuga ao tema/não atendimento à estrutura dissertativo-argumentativa",
    },
  ],
};

const ENEM_CRITERIA = [
  { id: "c1", name: "Domínio da modalidade escrita formal", points: null },
  { id: "c2", name: "Compreensão da proposta e repertório", points: null },
  { id: "c3", name: "Seleção e organização de argumentos", points: null },
  { id: "c4", name: "Mecanismos linguísticos de coesão", points: null },
  { id: "c5", name: "Proposta de intervenção", points: null },
];

function enemBasis(theme: string, title: string): Basis {
  return basis({
    aspects: [
      {
        criterionId: "c2",
        description: `Discute o tema exato (${theme}), e não só o assunto amplo`,
        points: null,
      },
      {
        criterionId: "c2",
        description: "Usa repertório legítimo, pertinente e articulado à argumentação",
        points: null,
      },
      {
        criterionId: "c3",
        description: "Defende um ponto de vista com argumentos desenvolvidos e relacionados",
        points: null,
      },
      {
        criterionId: "c5",
        description:
          "Propõe intervenção com agente, ação, meio, efeito e detalhamento, respeitando os direitos humanos",
        points: null,
      },
    ],
    criteria: ENEM_CRITERIA,
    grading: ENEM_LEVELS,
    lines: null,
    taskKey: "enem-redacao",
    title,
    total: 1000,
  });
}

const HERITAGE_THEME = "Desafios para a valorização da herança africana no Brasil";

const HERITAGE_CONTEXT = `Texto I: Herança – o legado de crenças, conhecimentos, técnicas, costumes e tradições, transmitido por um grupo social de geração para geração.
Texto II: As culturas africanas e afro-brasileiras foram relegadas ao campo do folclore, o que reduz uma cultura a um conjunto de representações estereotipadas.`;

const HERITAGE_QUESTION = `A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema "${HERITAGE_THEME}", apresentando proposta de intervenção que respeite os direitos humanos.`;

const VACCINE_PROMPT = `Tema: Desafios para combater a desinformação sobre vacinas no Brasil.
Texto I: A cobertura vacinal infantil caiu no Brasil na última década, e doenças antes controladas voltaram a preocupar as autoridades de saúde.
Texto II: Boatos sobre supostos riscos das vacinas circulam mais depressa em aplicativos de mensagem do que as informações oficiais.
Texto III: Criado em 1973, o Programa Nacional de Imunizações oferece gratuitamente dezenas de vacinas e é reconhecido internacionalmente.
Redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.`;

const LAI_PROMPT = `Redija um texto dissertativo acerca da Lei de Acesso à Informação (Lei n.º 12.527/2011). Ao elaborar seu texto, aborde os seguintes aspectos:
1 a diferença entre transparência ativa e transparência passiva;
2 os prazos para a resposta a um pedido de acesso;
3 a classificação de informações sigilosas e os prazos máximos de restrição de acesso.`;

const LAI_KEY_POINTS = [
  "Transparência ativa: os órgãos divulgam informações de interesse coletivo independentemente de requerimento (art. 8º); transparência passiva: atendimento a pedidos de acesso de qualquer interessado (art. 10)",
  "Acesso imediato; não sendo possível, prazo de até 20 dias, prorrogável por mais 10 dias mediante justificativa expressa (art. 11)",
  "Graus de sigilo: ultrassecreta até 25 anos, secreta até 15 anos e reservada até 5 anos (art. 24, § 1º)",
];

const OAB_PROMPT = `Joana Martins, solteira, professora, residente em Belo Horizonte/MG, comprou em 5 de março de 2026, na loja Casa Fria Eletrodomésticos Ltda., com sede em Belo Horizonte/MG, uma geladeira nova por R$ 4.000,00. Vinte dias depois, o aparelho parou de refrigerar. Em 26 de março, Joana levou o produto à assistência técnica indicada pela loja e, até 15 de maio, o vício não havia sido sanado. A loja se recusa a trocar o produto ou a devolver o valor pago, alegando que a responsabilidade é exclusiva do fabricante. Joana perdeu alimentos no valor de R$ 600,00, comprovados por notas fiscais.
Na qualidade de advogado(a) de Joana, que deseja receber de volta o valor pago e ser indenizada pelo prejuízo, sem recorrer ao Juizado Especial, elabore a peça processual cabível. (Valor: 5,00)`;

const OAB_KEY_POINTS = [
  "Endereçamento ao Juízo da Vara Cível da Comarca de Belo Horizonte/MG, foro do domicílio da consumidora (art. 101, I, do CDC)",
  "Partes: Joana Martins (autora) e Casa Fria Eletrodomésticos Ltda. (ré)",
  "Breve exposição dos fatos",
  "Relação de consumo: consumidora e fornecedora (arts. 2º e 3º do CDC)",
  "Responsabilidade solidária do comerciante pelo vício do produto (art. 18, caput, do CDC), afastando a alegação de responsabilidade exclusiva do fabricante",
  "Vício não sanado em 30 dias: restituição imediata da quantia paga, monetariamente atualizada, sem prejuízo de perdas e danos (art. 18, § 1º, II, do CDC)",
  "Danos materiais pelos alimentos perdidos (art. 6º, VI, do CDC)",
  "Inversão do ônus da prova (art. 6º, VIII, do CDC)",
  "Pedidos: citação da ré, opção pela audiência de conciliação, inversão do ônus da prova, restituição de R$ 4.000,00 atualizados, indenização de R$ 600,00, custas e honorários, produção de provas",
  "Valor da causa de R$ 4.600,00 (art. 292, VI, do CPC); local, data, advogado e OAB",
];

const NO_SCALE: Grading = {
  criteria: [],
  kind: "levels",
  language: null,
  rounding: null,
  zeroing: [],
};

const LAI_BASIS = basis({
  aspects: [
    {
      criterionId: "structure",
      description: "Texto dissertativo em parágrafos, com introdução, desenvolvimento e conclusão",
      points: null,
    },
    { criterionId: "transparency", description: LAI_KEY_POINTS[0] ?? "", points: null },
    { criterionId: "deadlines", description: LAI_KEY_POINTS[1] ?? "", points: null },
    { criterionId: "secrecy", description: LAI_KEY_POINTS[2] ?? "", points: null },
  ],
  criteria: [
    { id: "structure", name: "Apresentação e estrutura textual", points: null },
    { id: "transparency", name: "Transparência ativa e passiva", points: null },
    { id: "deadlines", name: "Prazos de resposta", points: null },
    { id: "secrecy", name: "Sigilo e prazos de restrição", points: null },
  ],
  grading: NO_SCALE,
  lines: null,
  taskKey: "written-no-scale",
  title: "Lei de Acesso à Informação",
  total: null,
});

const OAB_BASIS = basis({
  aspects: [
    {
      criterionId: "fit",
      description: "Endereçamento ao Juízo da Vara Cível da Comarca de Belo Horizonte/MG",
      points: 0.1,
    },
    {
      criterionId: "fit",
      description: "Qualificação da autora e da ré nos polos corretos",
      points: 0.2,
    },
    {
      criterionId: "reasoning",
      description: "Relação de consumo (arts. 2º e 3º do CDC)",
      points: 0.4,
    },
    {
      criterionId: "reasoning",
      description:
        "Responsabilidade solidária do comerciante pelo vício do produto (art. 18 do CDC)",
      points: 0.8,
    },
    {
      criterionId: "reasoning",
      description:
        "Restituição da quantia paga após 30 dias sem sanar o vício (art. 18, § 1º, II, do CDC)",
      points: 0.8,
    },
    {
      criterionId: "reasoning",
      description: "Danos materiais pelos alimentos perdidos (art. 6º, VI, do CDC)",
      points: 0.5,
    },
    {
      criterionId: "reasoning",
      description: "Inversão do ônus da prova (art. 6º, VIII, do CDC)",
      points: 0.4,
    },
    {
      criterionId: "technique",
      description:
        "Pedidos de citação, restituição, indenização, custas e honorários e produção de provas",
      points: 1.2,
    },
    {
      criterionId: "technique",
      description: "Valor da causa (art. 292 do CPC) e fechamento com local, data, advogado e OAB",
      points: 0.6,
    },
  ],
  criteria: [
    { id: "fit", name: "Adequação da peça ao problema", points: null },
    { id: "reasoning", name: "Fundamentação e raciocínio jurídico", points: null },
    { id: "technique", name: "Técnica profissional", points: null },
  ],
  grading: {
    criteria: [],
    kind: "oab",
    language: null,
    rounding: null,
    zeroing: [
      {
        citation: {
          passage:
            "4.2.6. Nos casos de propositura de peça inadequada para a solução do problema proposto",
          sourceId: "oab-47-edital",
        },
        kinds: ["wrongForm"],
        text: "peça inadequada para a solução do problema proposto",
      },
    ],
  },
  lines: null,
  taskKey: "oab-peca",
  title: "Vício do produto e restituição",
  total: 5,
});

const PHOTOSYNTHESIS_QUESTION =
  "Explain how a plant turns light energy into chemical energy, naming the two stages of photosynthesis and what each one produces or uses, and say what happens to a plant kept in the dark for a long time.";

const PHOTOSYNTHESIS_BASIS = basis({
  aspects: [
    {
      criterionId: "stages",
      description:
        "Light-dependent reactions in the chloroplast: chlorophyll absorbs light, water is split, oxygen released, ATP and NADPH made",
      points: null,
    },
    {
      criterionId: "stages",
      description: "Calvin cycle: ATP and NADPH used to fix carbon dioxide into sugar",
      points: null,
    },
    {
      criterionId: "dark",
      description:
        "In the dark the plant uses stored starch and its growth slows, since it can't make new sugar",
      points: null,
    },
  ],
  criteria: [
    { id: "stages", name: "The two stages", points: null },
    { id: "dark", name: "A plant in the dark", points: null },
  ],
  grading: NO_SCALE,
  lines: null,
  minimumWords: 10,
  taskKey: "class-short-answer",
  title: "Photosynthesis stages",
  total: null,
});

const ALL_PLANO_REAL = [0, 1, 2, 3, 4, 5, 6, 7];

function planoReal(text: string): GradeWritingInput {
  return {
    arithmetic: CEBRASPE_ARITHMETIC,
    basis: PLANO_REAL_BASIS,
    context: null,
    keyPoints: PLANO_REAL_KEY_POINTS,
    language: "pt",
    question: PLANO_REAL_QUESTION,
    text,
  };
}

function impact(text: string): GradeWritingInput {
  return {
    arithmetic: CEBRASPE_ARITHMETIC,
    basis: IMPACT_BASIS,
    context: null,
    keyPoints: IMPACT_KEY_POINTS,
    language: "pt",
    question: IMPACT_QUESTION,
    text,
  };
}

const ENEM_ARITHMETIC: Arithmetic = { rounding: null, zeroRules: [0] };

function heritage(text: string): GradeWritingInput {
  return {
    arithmetic: ENEM_ARITHMETIC,
    basis: enemBasis(HERITAGE_THEME, "Herança africana no Brasil"),
    context: HERITAGE_CONTEXT,
    keyPoints: [],
    language: "pt",
    question: HERITAGE_QUESTION,
    text,
  };
}

const EXISTING_CASES: WritingCase[] = [
  {
    expected: {
      earned: ALL_PLANO_REAL,
      feedbackLanguage: "pt",
      languageErrors: [],
      traps: ["visava o corte", "até à chegada", "se tornou evidente", "à União"],
      zero: false,
    },
    id: "cgu-q30-full-clean-contested-usage-pt",
    userInput: planoReal(POINTS_ANSWERS.realFullClean),
  },
  {
    expected: {
      earned: ALL_PLANO_REAL,
      feedbackLanguage: "pt",
      languageErrors: ["houveram", "excessão", "à partir", "se mostrou decisivas"],
      zero: false,
    },
    id: "cgu-q30-full-four-errors-pt",
    userInput: planoReal(POINTS_ANSWERS.realFullFourErrors),
  },
  {
    expected: {
      earned: [1, 2, 5, 6, 7],
      feedbackLanguage: "pt",
      languageErrors: ["um dos problema", "concerteza", "se ajustasse", "atravéz", "muitas causa"],
      uncertain: [0],
      zero: false,
    },
    id: "cgu-q30-boundary-pass-side-pt",
    userInput: planoReal(POINTS_ANSWERS.realBoundaryPass),
  },
  {
    expected: {
      earned: [3, 4],
      feedbackLanguage: "pt",
      languageErrors: ["muito importante", "populaçao"],
      uncertain: [0],
      zero: false,
    },
    id: "cgu-q30-boundary-fail-side-pt",
    userInput: planoReal(POINTS_ANSWERS.realBoundaryFail),
  },
  {
    expected: {
      earned: [1, 5],
      feedbackLanguage: "pt",
      languageErrors: [],
      uncertain: [0],
      zero: false,
    },
    id: "cgu-q30-wrong-facts-no-credit-pt",
    userInput: planoReal(POINTS_ANSWERS.realWrongFacts),
  },
  {
    expected: {
      earned: [],
      feedbackLanguage: "pt",
      languageErrors: [],
      uncertain: [7],
      zero: false,
    },
    id: "cgu-q30-weak-short-not-zero-pt",
    userInput: planoReal(POINTS_ANSWERS.realWeakShort),
  },
  {
    expected: { earned: [], feedbackLanguage: "pt", languageErrors: [], zero: true },
    id: "cgu-q30-off-topic-zero-pt",
    userInput: planoReal(POINTS_ANSWERS.realOffTopic),
  },
  {
    expected: {
      earned: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      feedbackLanguage: "pt",
      languageErrors: ["hajam", "reforça"],
      traps: ["até ao término", "às cegas", "permite à administração"],
      zero: false,
    },
    id: "cgu-q60-strong-long-pt",
    userInput: impact(POINTS_ANSWERS.impactStrong),
  },
  {
    expected: {
      earned: [0, 1, 2, 4, 6, 9, 10, 14, 15],
      feedbackLanguage: "pt",
      languageErrors: ["esta sendo", "depende muito", "deveria realizá-la", "publica", "posam"],
      uncertain: [3, 7, 16, 17, 18],
      zero: false,
    },
    id: "cgu-q60-boundary-pass-side-pt",
    userInput: impact(POINTS_ANSWERS.impactBoundary),
  },
  {
    expected: {
      earned: [0, 1, 2, 3],
      feedbackLanguage: "pt",
      languageErrors: ["exibido", "e impedindo"],
      minimumLevel: "strong",
      traps: ["de participarem", "foram negros"],
      zero: false,
    },
    id: "enem-inep-ana-clara-pt",
    userInput: heritage(INEP_REDACOES.anaClaraPereira),
  },
  {
    expected: {
      earned: [0, 1, 2, 3],
      feedbackLanguage: "pt",
      languageErrors: [
        "empasses",
        "cresce",
        "esteriotipadas",
        "razo",
        "Ministério da educação",
        "Immanuel Kant “O",
      ],
      traps: ["impacta na problemática"],
      zero: false,
    },
    id: "enem-inep-camila-pt",
    userInput: heritage(INEP_REDACOES.camilaDeSaoTiagoSilva),
  },
  {
    expected: {
      earned: [0, 1, 2, 3],
      feedbackLanguage: "pt",
      languageErrors: [
        "herança da identidade",
        "Eugenista",
        "quando é abordada",
        "jovens; disseminando",
        "origens africanas e transformando",
        "seu livro, “Pequeno",
        "livros., Nesse",
        "destinar",
      ],
      minimumLevel: "strong",
      officialTotal: 980,
      traps: ["acreditava-se", "faz-se necessário", "evoluirmos"],
      zero: false,
    },
    id: "enem-inep-pedro-pt",
    userInput: heritage(INEP_REDACOES.pedroRicardoAlvesFreitas),
  },
  {
    expected: {
      earned: [],
      feedbackLanguage: "pt",
      languageErrors: [],
      zero: true,
      zeroKind: "offTopic",
    },
    id: "enem-off-topic-zero-pt",
    userInput: {
      arithmetic: ENEM_ARITHMETIC,
      basis: enemBasis(
        "Desafios para combater a desinformação sobre vacinas no Brasil",
        "Desinformação sobre vacinas",
      ),
      context: null,
      keyPoints: [],
      language: "pt",
      question: VACCINE_PROMPT,
      text: LEVELS_ANSWERS.offTopicSocialMedia,
    },
  },
  {
    expected: {
      earned: [0, 1, 2],
      feedbackLanguage: "pt",
      languageErrors: [],
      nextStepCriteria: ["secrecy"],
      zero: false,
    },
    id: "no-scale-levels-lai-wrong-secrecy-terms-pt",
    userInput: {
      arithmetic: null,
      basis: LAI_BASIS,
      context: null,
      keyPoints: LAI_KEY_POINTS,
      language: "pt",
      question: LAI_PROMPT,
      text: LEVELS_ANSWERS.cebraspeLai,
    },
  },
  {
    expected: {
      earned: [0, 1],
      feedbackLanguage: "pt",
      languageErrors: [],
      nextStepCriteria: ["reasoning"],
      uncertain: [2, 5, 7],
      zero: false,
    },
    id: "oab-peca-wrong-provisions-pt",
    userInput: {
      arithmetic: null,
      basis: OAB_BASIS,
      context: null,
      keyPoints: OAB_KEY_POINTS,
      language: "pt",
      question: OAB_PROMPT,
      text: LEVELS_ANSWERS.oabConsumerRefund,
    },
  },
  {
    expected: {
      earned: [0, 1, 2],
      feedbackLanguage: "en",
      languageErrors: ["Their growth"],
      traps: ["to quickly use up", "And it does"],
      zero: false,
    },
    id: "no-scale-class-test-split-infinitive-en",
    userInput: {
      arithmetic: null,
      basis: PHOTOSYNTHESIS_BASIS,
      context: null,
      keyPoints: [],
      language: "en",
      question: PHOTOSYNTHESIS_QUESTION,
      text: EN_ANSWERS.classTestPhotosynthesis,
    },
  },
];

const OPENAI_AUTHOR = "OpenAI GPT-6.2 Sol";
const GEMINI_AUTHOR = "Google Gemini 3.5 Flash-Lite";

function impactScenario(text: string): GradeWritingInput {
  return {
    ...impact(text),
    context:
      "O município criou um auxílio-transporte para combater a evasão escolar. A secretaria de educação precisa avaliar o impacto do programa.",
    question: IMPACT_QUESTION.replace(
      "acerca da avaliação de impacto de políticas públicas e de programas sociais",
      "acerca da avaliação de impacto do auxílio-transporte descrito",
    ),
  };
}

function cguBoundary({
  id,
  userInput,
  author,
  otherAnswers,
  expected,
}: {
  id: string;
  userInput: GradeWritingInput;
  author: string;
  otherAnswers: number;
  expected: Partial<GradeWritingExpected>;
}) {
  return publishedCase({
    expected: { ...expected, passBoundary: { otherAnswers, sectionMinimum: 50 } },
    id: `cgu-${id}`,
    source: { author, board: "Cebraspe", notice: CGU_NOTICE, reference: MPO_STANDARD },
    userInput,
  });
}

const BOUNDARY_CASES = [
  cguBoundary({
    author: OPENAI_AUTHOR,
    expected: {
      earned: [0, 1, 3, 5],
      traps: [
        "onde os consumidores",
        "anunciou limites, e os comerciantes",
        "se mostrou reversível",
        "assistiu ao retorno",
      ],
    },
    id: "q30-openai-below",
    otherAnswers: 33,
    userInput: planoReal(OPENAI_ANSWERS.realBelow),
  }),
  cguBoundary({
    author: OPENAI_AUTHOR,
    expected: {
      earned: [0, 1, 3, 4],
      languageErrors: ["estratéjia", "ratificar a previsão", "As medidas foi decisivas"],
      traps: ["até à política", "juros, e os consumidores", "estabelecimento onde"],
    },
    id: "q30-openai-above",
    otherAnswers: 35,
    userInput: planoReal(OPENAI_ANSWERS.realAbove),
  }),
  cguBoundary({
    author: OPENAI_AUTHOR,
    expected: {
      earned: [0, 1, 2, 4, 5, 8, 9, 11],
      traps: ["até à sua equipe", "chegada, e a refeição", "onde funcionam"],
    },
    id: "q60-openai-below",
    otherAnswers: 13,
    userInput: impactScenario(OPENAI_ANSWERS.impactBelow),
  }),
  cguBoundary({
    author: OPENAI_AUTHOR,
    expected: {
      earned: [0, 1, 2, 3, 4, 9, 16, 17, 18],
      traps: ["informou a sua equipe sobre", "conclusões à sua equipe", "bairros onde"],
      uncertain: [7, 14, 15],
    },
    id: "q60-openai-above",
    otherAnswers: 13,
    userInput: impactScenario(OPENAI_ANSWERS.impactAbove),
  }),
  cguBoundary({
    author: GEMINI_AUTHOR,
    expected: {
      earned: [0, 1, 3],
      languageErrors: ["contidasse"],
      traps: ["No que tange às", "utilizam-se de"],
    },
    id: "q30-gemini-below",
    otherAnswers: 36,
    userInput: planoReal(GEMINI_ANSWERS.shortBelow),
  }),
  cguBoundary({
    author: GEMINI_AUTHOR,
    expected: { earned: [0, 1, 2, 4, 6] },
    id: "q30-gemini-above",
    otherAnswers: 32,
    userInput: planoReal(GEMINI_ANSWERS.shortAbove),
  }),
  cguBoundary({
    author: GEMINI_AUTHOR,
    expected: { earned: [0, 1, 2, 4, 5, 8, 9], uncertain: [10] },
    id: "q60-gemini-below",
    otherAnswers: 13,
    userInput: impactScenario(GEMINI_ANSWERS.longBelow),
  }),
  cguBoundary({
    author: GEMINI_AUTHOR,
    expected: { earned: [0, 1, 2, 4, 5, 8, 9, 10, 11, 12] },
    id: "q60-gemini-above",
    otherAnswers: 8,
    userInput: impactScenario(GEMINI_ANSWERS.longAbove),
  }),
];

const FGV_TJAM_CASE = publishedCase({
  expected: { earned: [0, 1, 2, 3] },
  id: "fgv-tjam-p2-q1-openai",
  source: {
    author: OPENAI_AUTHOR,
    board: "FGV",
    notice:
      "https://conhecimento.fgv.br/sites/default/files/concursos/edital_tjam_juiz_2014_09_17_retificado.pdf",
    reference: "https://conhecimento.fgv.br/sites/default/files/concursos/direito_civil_01_02.pdf",
  },
  userInput: publishedQuestion({
    citation: {
      passage: "11.4.1 Cada questão da prova escrita P2 valerá 0,4 (quatro décimos) pontos.",
      sourceId: "tjam-2013-edital-001",
    },
    kind: "points",
    lines: 15,
    question:
      "José deixou um seguro de vida em favor da filha menor, Marina. Sua mãe, Luísa, pede alvará para receber o capital em nome da filha. O Ministério Público pede que o dinheiro permaneça depositado em juízo até a maioridade, salvo necessidade comprovada. Examine a situação e apresente solução fundamentada.",
    sections: [
      {
        // The published standard states no weights within the question. The full-credit case is invariant to this split.
        aspects: [
          ["A mãe exerce exclusivamente o poder familiar após a morte do pai", 0.1],
          ["A mãe administra os bens da menor e pode receber o valor em nome dela", 0.1],
          [
            "A restrição proposta pelo MP não é necessária na ausência de risco concreto e o recebimento não excede a administração ordinária",
            0.1,
          ],
          ["Expedir o alvará de levantamento", 0.1],
        ],
        id: "content",
        name: "Conteúdo e fundamentação",
      },
    ],
    taskKey: "tjam-2013-p2-q1",
    text: OPENAI_ANSWERS.tjamInsurance,
    title: "Seguro de vida em favor de menor",
  }),
});

const OAB_SOURCE = {
  author: OPENAI_AUTHOR,
  board: "FGV",
  notice: OAB_NOTICE,
  reference: OAB_STANDARD,
};

const OAB_ITEM_CITATION = {
  passage: "4.2.2. (…) cada questão terá o valor máximo de 1,25 (um e vinte e cinco) ponto.",
  sourceId: "oab-46-edital",
};

const OAB_CASES = [
  publishedCase({
    expected: {
      earned: [0, 1, 2, 4, 5, 6],
      passBoundary: { otherAnswers: 4.9, sectionMinimum: 6 },
    },
    id: "oab-46-civil-q1-openai",
    source: OAB_SOURCE,
    userInput: publishedQuestion({
      citation: OAB_ITEM_CITATION,
      kind: "oab",
      lines: 30,
      question:
        "Joaquim doou à filha Júlia um imóvel de R$ 1 milhão, sem dispensá-la da colação. Quando ele faleceu, deixou R$ 1,5 milhão e três filhas, Elena, Carla e Júlia. Júlia renunciou à herança e tem uma filha, Paula. A) Paula sucede por representação? Qual o efeito da renúncia sobre a partilha? B) A renúncia protege o imóvel de Júlia? Indique a medida cabível às irmãs.",
      sections: [
        {
          aspects: [
            ["Paula não sucede por representação de Júlia", 0.15],
            ["Fundamenta a impossibilidade de representação no art. 1.811 do CC", 0.1],
            ["O quinhão da renunciante acresce aos das irmãs, herdeiras da mesma classe", 0.3],
            ["Fundamenta o acréscimo no art. 1.810 do CC", 0.1],
          ],
          id: "renunciation",
          name: "Representação e acréscimo",
        },
        {
          aspects: [
            ["A renúncia não dispensa a colação da doação", 0.2],
            ["Fundamenta a obrigação no art. 640 do CPC ou no art. 2.008 do CC", 0.1],
            ["As irmãs devem requerer ao juízo do inventário a colação do valor do bem", 0.2],
            ["Fundamenta a medida no art. 641 do CPC", 0.1],
          ],
          id: "collation",
          name: "Colação do imóvel",
        },
      ],
      taskKey: "oab-46-civil-q1",
      text: OPENAI_ANSWERS.oabInheritance,
      title: "Renúncia à herança e colação",
    }),
  }),
  publishedCase({
    expected: { earned: [0, 1, 2, 3], passBoundary: { otherAnswers: 4.9, sectionMinimum: 6 } },
    id: "oab-46-civil-q2-openai",
    source: OAB_SOURCE,
    userInput: publishedQuestion({
      citation: OAB_ITEM_CITATION,
      kind: "oab",
      lines: 30,
      question:
        "Paulo Dirceu, de 23 anos, quer retirar Dirceu de seu prenome. O pai, que também se chama Dirceu, abandonou a família quando Paulo era bebê. A) A exclusão é juridicamente possível? B) Paulo é obrigado a ajuizar ação para fazê-la? Fundamente.",
      sections: [
        {
          aspects: [
            ["É possível alterar o prenome após atingir a maioridade civil", 0.2],
            ["Paulo deve requerer a alteração pessoalmente, sem motivação", 0.35],
            ["Fundamenta a alteração no art. 56, caput, da Lei nº 6.015/1973", 0.1],
          ],
          id: "viability",
          name: "Viabilidade e requisitos",
        },
        {
          aspects: [
            [
              "É possível alterar o prenome sem motivação uma única vez pela via extrajudicial",
              0.5,
            ],
            ["Fundamenta a via extrajudicial no art. 56, § 1º, da Lei nº 6.015/1973", 0.1],
          ],
          id: "route",
          name: "Via extrajudicial",
        },
      ],
      taskKey: "oab-46-civil-q2",
      text: OPENAI_ANSWERS.oabGivenName,
      title: "Alteração do prenome",
    }),
  }),
];

const ENEM_SOURCE = { author: OPENAI_AUTHOR, board: "Inep", reference: INEP_GUIDE };

const ENEM_ZERO_RULES: Grading["zeroing"] = [
  { kinds: ["blank"], text: "Folha de redação sem texto" },
  { kinds: ["identification"], text: "Identificação do participante no espaço destinado ao texto" },
  {
    kinds: ["copiedSupport"],
    maxLines: 7,
    text: "Até sete linhas originais após desconsiderar as linhas copiadas dos textos de apoio",
  },
  { kinds: ["tooFewLines"], maxLines: 7, text: "Texto insuficiente: até sete linhas manuscritas" },
  { kinds: ["offTopic"], text: "Fuga total ao tema" },
  { kinds: ["wrongForm"], text: "Texto fora do tipo dissertativo-argumentativo" },
].map((rule): Grading["zeroing"][number] => ({
  ...rule,
  citation: { passage: rule.text, sourceId: "inep-cartilha-2025-pp7-8" },
  kinds: rule.kinds as ZeroKind[],
}));

function enemZeroCase({
  id,
  text,
  zeroKind,
  earned = [],
  uncertain,
}: {
  id: string;
  text: string;
  zeroKind?: ZeroKind;
  earned?: number[];
  uncertain?: number[];
}): WritingCase {
  const task = enemBasis(
    "Desafios para combater a desinformação sobre vacinas no Brasil",
    "Desinformação sobre vacinas",
  );

  return publishedCase({
    expected: { earned, uncertain, zero: zeroKind !== undefined, zeroKind },
    id: `enem-${id}-openai`,
    source: ENEM_SOURCE,
    userInput: {
      arithmetic: { rounding: null, zeroRules: ENEM_ZERO_RULES.map((_, index) => index) },
      basis: { ...task, grading: { ...task.grading, zeroing: ENEM_ZERO_RULES }, lines: 30 },
      context: ENEM_ZERO_ANSWERS.support,
      keyPoints: [],
      language: "pt",
      question:
        "Redija um texto dissertativo-argumentativo em português formal sobre os desafios para combater a desinformação sobre vacinas no Brasil. Apresente uma proposta de intervenção que respeite os direitos humanos.",
      text,
    },
  });
}

const ENEM_ZERO_CASES = [
  enemZeroCase({ earned: [0, 2, 3], id: "before-maximum", text: ENEM_ZERO_ANSWERS.almostFull }),
  enemZeroCase({ id: "blank", text: "", zeroKind: "blank" }),
  enemZeroCase({
    earned: [0],
    id: "seven-lines",
    text: ENEM_ZERO_ANSWERS.original.split("\n").slice(0, 7).join("\n"),
    uncertain: [2, 3],
    zeroKind: "tooFewLines",
  }),
  enemZeroCase({
    id: "copied-support",
    text: ENEM_ZERO_ANSWERS.support,
    uncertain: [0],
    zeroKind: "copiedSupport",
  }),
  enemZeroCase({ id: "wrong-form", text: ENEM_ZERO_ANSWERS.wrongForm, zeroKind: "wrongForm" }),
  enemZeroCase({
    earned: [0],
    id: "signature",
    text: `${ENEM_ZERO_ANSWERS.original}\nAssinatura: Marília Ribeiro de Almeida`,
    uncertain: [2, 3],
    zeroKind: "identification",
  }),
  enemZeroCase({ id: "tangent", text: ENEM_ZERO_ANSWERS.tangent, uncertain: [2, 3] }),
  enemZeroCase({
    earned: [0],
    id: "one-copied-line",
    text: `${ENEM_ZERO_ANSWERS.support.split("\n")[0]}\n${ENEM_ZERO_ANSWERS.original}`,
    uncertain: [2, 3],
  }),
  enemZeroCase({
    earned: [0],
    id: "eight-original-lines",
    text: ENEM_ZERO_ANSWERS.original,
    uncertain: [2, 3],
  }),
];

function sourceForExisting(testCase: WritingCase): NonNullable<GradeWritingExpected["source"]> {
  const author = "Anthropic Claude";

  if (testCase.id.startsWith("cgu-")) {
    return { author, board: "Cebraspe", notice: CGU_NOTICE, reference: MPO_STANDARD };
  }

  if (testCase.id.startsWith("enem-inep-")) {
    return {
      author: "Inep published candidate",
      board: "Inep",
      reference: INEP_GUIDE,
      ...(testCase.id === "enem-inep-pedro-pt" && {
        scoreReference:
          "https://www.ce.gov.br/seduc/2025/02/11/aprovado-para-cursar-tres-graduacoes-cearense-ingressa-em-ciencia-de-dados-no-rj/",
      }),
    };
  }

  return { author, board: testCase.id.startsWith("enem-") ? "Inep" : "Practice", reference: null };
}

export const TEST_CASES: WritingCase[] = [
  ...EXISTING_CASES.map((testCase) => ({
    ...testCase,
    expected: testCase.expected && { ...testCase.expected, source: sourceForExisting(testCase) },
  })),
  ...BOUNDARY_CASES,
  FGV_TJAM_CASE,
  ...OAB_CASES,
  ...ENEM_ZERO_CASES,
  ...CEBRASPE_PUBLISHED_CASES,
  ...FGV_PUBLISHED_CASES,
  ...ENEM_PUBLISHED_CASES,
];
