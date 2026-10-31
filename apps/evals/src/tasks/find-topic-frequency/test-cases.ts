import { type TestCase } from "@/lib/types";
import { type FindTopicFrequencyParams } from "@zoonk/ai/tasks/research/find-topic-frequency";
import { type FindTopicFrequencyExpected } from "./task";

type FindTopicFrequencyCase = TestCase<FindTopicFrequencyExpected, FindTopicFrequencyParams>;

const TODAY = "2026-10-07";

const NATUREZA = "Ciências da Natureza e suas Tecnologias";
const HUMANAS = "Ciências Humanas e suas Tecnologias";

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

const CGU_ADMINISTRACAO_TOPICS = [
  "1 Organização administrativa",
  "1.1 Administração direta e indireta; descentralização e desconcentração; agentes públicos; funções da administração pública: formulação, execução, regulação e controle de políticas e ações públicas; arranjos de cooperação com entes federativos e entidades não estatais",
  "2 Modelos de administração",
  "2.1 Burocracia e profissionalização; gestão orientada a resultados; participação e governança; limites e contribuições de diferentes modelos na realidade brasileira",
  "3 Políticas públicas",
  "3.1 Problema público, agenda e formulação; instrumentos de ação estatal; implementação, monitoramento e avaliação; intersetorialidade e atores governamentais e sociais",
  "4 Planejamento e recursos",
  "4.1 Funções do planejamento e do orçamento; relação entre PPA, LDO e LOA; receita e despesa em nível conceitual; restrições fiscais, escolhas alocativas e sustentabilidade das ações",
  "5 Serviços e transformação digital",
  "5.1 Orientação ao usuário; simplificação e acessibilidade; coordenação de serviços; oportunidades e riscos da automação e da inteligência artificial na administração",
];

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
  {
    expected: { found: [], notHigh: [], notLow: [], onlyFound: true },
    id: "pt-cgu-2026-new-board-and-syllabus",
    userInput: {
      board: "Cebraspe",
      exam: "CGU, Auditor Federal de Finanças e Controle",
      subjects: [
        {
          name: "Administração Pública e Fundamentos de Políticas Públicas",
          topics: CGU_ADMINISTRACAO_TOPICS,
        },
      ],
      today: "2026-10-30",
    },
  },
];
