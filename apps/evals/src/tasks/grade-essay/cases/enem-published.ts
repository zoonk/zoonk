import { ENEM_ANSWERS, matchesEnemResearchAnswer, readEnemResearchAnswers } from "./enem-answers";
import { type WritingCase, basis, publishedCase } from "./shared";

const INEP_2020 =
  "https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/a_redacao_do_enem_2020_-_cartilha_do_participante.pdf";

const EXAM_2019 =
  "https://download.inep.gov.br/educacao_basica/enem/provas/2019/2019_PV_impresso_D1_CD2.pdf";

// Rossman, Silveira and Mauá, section 3: https://aclanthology.org/2026.propor-1.16/
// The dataset documents research consent. Read the text from a local export of the pinned release.
const RESEARCH_DATASET =
  "https://huggingface.co/datasets/laisnuto/self-collected-ENEM-dataset/blob/1062474/enem_dataset.csv";

const THEME = "Democratização do acesso ao cinema no Brasil";
const QUESTION = `A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema “${THEME}”, apresentando proposta de intervenção que respeite os direitos humanos. Selecione, organize e relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.`;

const CONTEXT = `Texto I (Jean-Claude Bernardet): na primeira exibição pública de cinema, em Paris, em 1895, Lumière desaconselhou Georges Mélies de adquirir o cinematógrafo. Via-o como instrumento científico para reproduzir o movimento, sem futuro como espetáculo. Como a máquina passou a contar histórias para enormes plateias?
Texto II (C. F. Gutfreind): para Edgar Morin, o cinema registra e restitui a existência, levando em conta o universo pessoal e solicitando a participação do espectador.
Texto III (Meio & Mensagem, infográfico): nos últimos cinco anos, a penetração do cinema cresceu 43% entre os brasileiros. 17% da população frequentou o cinema nos últimos 30 dias. 88% dos telespectadores veem filmes na TV regularmente. 19% dos telespectadores de filmes na TV vão ao cinema; 95% dos que foram ao cinema assistem a filmes na TV.
Texto IV (Ancine): em 1975, o Brasil tinha quase 3 300 salas, 80% no interior, e uma sala para cada 30 mil habitantes. Urbanização acelerada, pouco investimento, baixa capitalização e mudanças tecnológicas alteraram a distribuição. Em 1997 restavam pouco mais de mil salas. Com os shopping centers, o total voltou a 2 200, concentrado nas áreas mais ricas das grandes cidades. Norte, Nordeste, periferias e cidades pequenas e médias ficaram excluídos ou mal atendidos.`;

const CINEMA_BASIS = basis({
  aspects: [
    {
      criterionId: "c2",
      description: `Discute o tema exato (${THEME}), e não só o assunto amplo`,
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
  criteria: [
    { id: "c1", name: "Domínio da modalidade escrita formal", points: null },
    { id: "c2", name: "Compreensão da proposta e repertório", points: null },
    { id: "c3", name: "Seleção e organização de argumentos", points: null },
    { id: "c4", name: "Mecanismos linguísticos de coesão", points: null },
    { id: "c5", name: "Proposta de intervenção", points: null },
  ],
  grading: {
    criteria: [],
    kind: "enem",
    language: null,
    rounding: null,
    zeroing: [
      {
        citation: {
          passage: "4.2. fugir ao tema ou que não atender ao tipo dissertativo-argumentativo.",
          sourceId: "enem-2019-day-1-yellow",
        },
        kinds: ["offTopic", "wrongForm"],
        text: "Fuga ao tema/não atendimento à estrutura dissertativo-argumentativa",
      },
    ],
  },
  // The original sheets met the handwritten line limit. Typed transcriptions omit those line breaks.
  lines: null,
  taskKey: "enem-redacao",
  title: "Acesso ao cinema no Brasil",
  total: 1000,
});

function cinemaInput(text: string) {
  return {
    arithmetic: { rounding: null, zeroRules: [0] },
    basis: CINEMA_BASIS,
    context: CONTEXT,
    keyPoints: [],
    language: "pt",
    question: QUESTION,
    text,
  };
}

const INEP_CASES = [
  {
    id: "a",
    languageErrors: ["habilidade que o permite ver"],
    page: 35,
    text: ENEM_ANSWERS.cinemaA,
  },
  { id: "b", languageErrors: [], page: 37, text: ENEM_ANSWERS.cinemaB },
  { id: "c", languageErrors: [], page: 39, text: ENEM_ANSWERS.cinemaC },
  { id: "d", languageErrors: [], page: 41, text: ENEM_ANSWERS.cinemaD },
].map(({ id, languageErrors, page, text }) =>
  publishedCase({
    expected: {
      earned: [0, 1, 2, 3],
      languageErrors,
      officialCompetences: { c1: 200, c2: 200, c3: 200, c4: 200, c5: 200 },
      officialTotal: 1000,
    },
    id: `enem-published-2019-cinema-${id}`,
    source: {
      author: "Inep published candidate",
      board: "Inep",
      notice: `${EXAM_2019}#page=20`,
      reference: `${INEP_2020}#page=${page}`,
      scoreReference: `${INEP_2020}#page=33`,
    },
    userInput: cinemaInput(text),
  }),
);

// One-based CSV data row numbers exclude the header. Each row carries the five official scores.
const RESEARCH_CASES = [
  {
    id: "980-a",
    row: 135,
    scores: { c1: 180, c2: 200, c3: 200, c4: 200, c5: 200 },
    sha256: "c215f97703e0d6f082bbc9ac24d88b98675634b2dd78b1932116b7ad1baa4a66",
    total: 980,
  },
  {
    id: "960-a",
    row: 25,
    scores: { c1: 200, c2: 200, c3: 180, c4: 200, c5: 180 },
    sha256: "d1180f3897fdbca1a975690b850ab18634ab433efe2a52a9173fc5e469883f20",
    total: 960,
  },
  {
    id: "960-b",
    row: 109,
    scores: { c1: 160, c2: 200, c3: 200, c4: 200, c5: 200 },
    sha256: "ba9422ac20b1395e41eea1c5b1bd58aeda6760ed62c10ea9f4df255a1d193422",
    total: 960,
  },
  {
    id: "940-a",
    row: 149,
    scores: { c1: 160, c2: 200, c3: 200, c4: 200, c5: 180 },
    sha256: "509958b962fda2025e6c8b6213dff45b0feb3a3ec3d885610ff8e555c07d72c4",
    total: 940,
  },
  {
    id: "840-a",
    row: 3,
    scores: { c1: 160, c2: 160, c3: 160, c4: 160, c5: 200 },
    sha256: "2b886d38690c362f18bb0d219a2539f671237888ae5298d1e710ec0a6cc36e82",
    total: 840,
  },
  {
    id: "800-a",
    row: 131,
    scores: { c1: 160, c2: 120, c3: 160, c4: 160, c5: 200 },
    sha256: "eea91a11f3a22fd9aff030fdf93e6f656b797cbfa512df95a10fda2929418ebd",
    total: 800,
  },
  {
    id: "700-a",
    row: 15,
    scores: { c1: 140, c2: 140, c3: 140, c4: 140, c5: 140 },
    sha256: "9ec20d951d7b7b1f4691d00fdd6eb2b0ce3b920f666171bb45521713777bacf5",
    total: 700,
  },
  {
    id: "600-a",
    row: 17,
    scores: { c1: 120, c2: 120, c3: 140, c4: 120, c5: 100 },
    sha256: "4f5194ef175a8378beb2109baa9c8b6affebdc69ddc5d1af6f363821c31e7a44",
    total: 600,
  },
];

function researchCases() {
  const answers = readEnemResearchAnswers();

  if (!answers) {
    return [];
  }

  return RESEARCH_CASES.map(({ id, row, scores, sha256, total }) => {
    const text = answers[String(row)];

    if (!text || !matchesEnemResearchAnswer(text, sha256)) {
      throw new Error(
        `ENEM_RESEARCH_ANSWERS_PATH must contain the exact text from dataset row ${row}.`,
      );
    }

    return publishedCase({
      expected: { officialCompetences: scores, officialTotal: total, uncertain: [0, 1, 2, 3] },
      id: `enem-research-2019-cinema-${id}`,
      source: {
        author: "De-identified candidate",
        board: "Inep",
        notice: `${EXAM_2019}#page=20`,
        reference: RESEARCH_DATASET,
        scoreReference: RESEARCH_DATASET,
      },
      userInput: cinemaInput(text),
    });
  });
}

export const ENEM_PUBLISHED_CASES: WritingCase[] = [...INEP_CASES, ...researchCases()];
