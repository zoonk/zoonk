import { type TestCase } from "@/lib/types";
import { type FindTopicFrequencyParams } from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import { type FindTopicFrequencyExpected } from "./task";

type FindTopicFrequencyCase = TestCase<FindTopicFrequencyExpected, FindTopicFrequencyParams>;

const TODAY = "2026-10-07";

const NATUREZA = "Ciências da Natureza e suas Tecnologias";
const HUMANAS = "Ciências Humanas e suas Tecnologias";

/** ENEM's objetos de conhecimento as its notice lists them (Edital do Enem 2026). */
const NATUREZA_TOPICS = [
  "Conhecimentos básicos e fundamentais",
  "O movimento, o equilíbrio e a descoberta de leis físicas",
  "Energia, trabalho e potência",
  "A Mecânica e o funcionamento do Universo",
  "Fenômenos Elétricos e Magnéticos",
  "Oscilações, ondas, óptica e radiação",
  "O calor e os fenômenos térmicos",
  "Transformações químicas",
  "Representação das transformações químicas",
  "Materiais, suas propriedades e usos",
  "Água",
  "Transformações químicas e energia",
  "Dinâmica das transformações químicas",
  "Transformação Química e Equilíbrio",
  "Compostos de Carbono",
  "Relações da Química com as tecnologias, a sociedade e o meio ambiente",
  "Energias químicas no cotidiano",
  "Moléculas, células e tecidos",
  "Hereditariedade e diversidade da vida",
  "Identidade dos seres vivos",
  "Ecologia e ciências ambientais",
  "Origem e evolução da vida",
  "Qualidade de vida das populações humanas",
];

const HUMANAS_TOPICS = [
  "Diversidade cultural, conflitos e vida em sociedade",
  "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
  "Características e transformações das estruturas produtivas",
  "Os domínios naturais e a relação do ser humano com o ambiente",
  "Representação espacial",
];

/**
 * Real exams, one subject at a time as research asks them. Analyses of ENEM's past papers agree that ecology, genetics and organic chemistry
 * are among Natureza's most asked topics and gravitation among its least; a concurso's Portuguese
 * under Cebraspe always leans on reading comprehension, though a source per subject may not exist.
 */
export const TEST_CASES: FindTopicFrequencyCase[] = [
  {
    expected: {
      found: [NATUREZA],
      notHigh: ["A Mecânica e o funcionamento do Universo"],
      notLow: [
        "Ecologia e ciências ambientais",
        "Hereditariedade e diversidade da vida",
        "Compostos de Carbono",
      ],
    },
    id: "pt-enem-natureza",
    userInput: {
      board: "Inep",
      exam: "ENEM",
      subjects: [{ name: NATUREZA, topics: NATUREZA_TOPICS }],
      today: TODAY,
    },
  },
  {
    expected: { found: [], notHigh: [], notLow: [] },
    id: "pt-enem-humanas",
    userInput: {
      board: "Inep",
      exam: "ENEM",
      subjects: [{ name: HUMANAS, topics: HUMANAS_TOPICS }],
      today: TODAY,
    },
  },
  {
    expected: {
      found: [],
      notHigh: [],
      notLow: ["1 Compreensão e interpretação de textos de gêneros variados"],
    },
    id: "pt-camara-portugues",
    userInput: {
      board: "Cebraspe",
      exam: "Concurso da Câmara dos Deputados, Analista Legislativo – Registro e Redação",
      subjects: [
        {
          name: "Língua Portuguesa",
          topics: [
            "1 Compreensão e interpretação de textos de gêneros variados",
            "2 Reconhecimento de tipos e gêneros textuais",
            "3 Domínio da ortografia",
            "4 Domínio dos mecanismos de coesão textual",
            "5 Domínio da estrutura morfossintática do período",
            "5.4 Emprego dos sinais de pontuação",
            "5.5 Concordância verbal e nominal",
            "5.7 Emprego do sinal indicativo de crase",
            "6 Reescrita de frases e parágrafos do texto",
          ],
        },
      ],
      today: TODAY,
    },
  },
];
