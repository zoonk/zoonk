import { type LibraryCourse } from "./library-cases";

/** Real Library skills from a 2026 measurement run: the Câmara dos Deputados exam graph. */
export const CAMARA_CONSTITUTIONAL: LibraryCourse = {
  courseTitle: "Direito Constitucional",
  skills: [
    {
      description:
        "Identificar a estrutura e as características da Constituição de 1988 e aplicar seus princípios fundamentais.",
      id: "camara-constituicao-principios-fundamentais",
      lessons: 24,
      level: "beginner",
      name: "Interpretar os princípios fundamentais da Constituição",
      prerequisiteIds: [],
    },
    {
      description:
        "Aplicar direitos e deveres individuais e coletivos a situações previstas na Constituição.",
      id: "camara-direitos-individuais-coletivos",
      lessons: 30,
      level: "beginner",
      name: "Aplicar direitos individuais e coletivos",
      prerequisiteIds: ["camara-constituicao-principios-fundamentais"],
    },
    {
      description:
        "Distinguir os entes federativos, sua autonomia e suas competências constitucionais.",
      id: "camara-organizacao-federativa",
      lessons: 28,
      level: "beginner",
      name: "Distinguir os entes e competências federativas",
      prerequisiteIds: ["camara-constituicao-principios-fundamentais"],
    },
    {
      description:
        "Aplicar as disposições constitucionais gerais sobre administração pública e servidores civis e militares.",
      id: "camara-administracao-publica-constituicao",
      lessons: 28,
      level: "intermediate",
      name: "Aplicar disposições constitucionais sobre servidores",
      prerequisiteIds: ["camara-constituicao-principios-fundamentais"],
    },
    {
      description:
        "Distinguir garantias constitucionais e avaliar seu cabimento em casos apresentados.",
      id: "camara-garantias-constitucionais",
      lessons: 26,
      level: "intermediate",
      name: "Distinguir garantias constitucionais fundamentais",
      prerequisiteIds: ["camara-direitos-individuais-coletivos"],
    },
    {
      description:
        "Aplicar as disposições constitucionais sobre direitos sociais, nacionalidade, direitos políticos e partidos.",
      id: "camara-direitos-sociais-politicos",
      lessons: 30,
      level: "intermediate",
      name: "Aplicar direitos sociais e políticos",
      prerequisiteIds: ["camara-constituicao-principios-fundamentais"],
    },
    {
      description:
        "Reconhecer hipóteses, procedimentos e limites constitucionais da intervenção federal.",
      id: "camara-intervencao-federal",
      lessons: 20,
      level: "intermediate",
      name: "Aplicar as regras de intervenção federal",
      prerequisiteIds: ["camara-organizacao-federativa"],
    },
    {
      description:
        "Distinguir competências, atribuições, reuniões e comissões do Congresso Nacional e de suas Casas.",
      id: "camara-congresso-casas-competencias",
      lessons: 30,
      level: "intermediate",
      name: "Distinguir competências do Congresso e suas Casas",
      prerequisiteIds: ["camara-constituicao-principios-fundamentais"],
    },
    {
      description:
        "Aplicar as regras constitucionais sobre imunidades, incompatibilidades e perda de mandato parlamentar.",
      id: "camara-regime-constitucional-parlamentares",
      lessons: 25,
      level: "intermediate",
      name: "Aplicar o regime constitucional dos parlamentares",
      prerequisiteIds: ["camara-congresso-casas-competencias"],
    },
  ],
};

export const CAMARA_ADMINISTRATIVE: LibraryCourse = {
  courseTitle: "Direito Administrativo",
  skills: [
    {
      description:
        "Distinguir Estado, governo e administração pública, seus elementos, poderes e formas de organização.",
      id: "camara-estado-governo-administracao",
      lessons: 18,
      level: "beginner",
      name: "Distinguir Estado, governo e administração pública",
      prerequisiteIds: [],
    },
    {
      description:
        "Aplicar princípios constitucionais e doutrinários da administração pública a situações administrativas.",
      id: "camara-principios-administracao-publica",
      lessons: 20,
      level: "beginner",
      name: "Aplicar princípios da administração pública",
      prerequisiteIds: [],
    },
    {
      description:
        "Distinguir administração direta e indireta e as formas de distribuição de competências e serviços.",
      id: "camara-organizacao-administrativa",
      lessons: 26,
      level: "beginner",
      name: "Distinguir formas de organização administrativa",
      prerequisiteIds: ["camara-estado-governo-administracao"],
    },
    {
      description:
        "Identificar requisitos, atributos e espécies de atos administrativos e julgar hipóteses de sua extinção, invalidação ou revogação.",
      id: "camara-atos-administrativos",
      lessons: 28,
      level: "intermediate",
      name: "Analisar atos administrativos e sua extinção",
      prerequisiteIds: ["camara-principios-administracao-publica"],
    },
    {
      description:
        "Distinguir tipos de parecer administrativo e hipóteses de responsabilidade de seu emissor.",
      id: "camara-responsabilidade-parecerista",
      lessons: 12,
      level: "intermediate",
      name: "Julgar a responsabilidade do parecerista",
      prerequisiteIds: ["camara-atos-administrativos"],
    },
    {
      description:
        "Distinguir os poderes administrativos e identificar seu exercício regular, excesso ou desvio de poder.",
      id: "camara-poderes-administrativos",
      lessons: 24,
      level: "intermediate",
      name: "Distinguir poderes administrativos e seus abusos",
      prerequisiteIds: ["camara-principios-administracao-publica"],
    },
    {
      description:
        "Distinguir espécies de agentes, cargos, empregos e funções e aplicar as regras administrativas sobre requisição e vínculo público.",
      id: "camara-agentes-vinculos-requisicao",
      lessons: 20,
      level: "beginner",
      name: "Distinguir vínculos e requisição de agentes",
      prerequisiteIds: [],
    },
    {
      description:
        "Aplicar as regras da Lei 8.112/1990 sobre provimento, vacância, movimentação e desenvolvimento funcional.",
      id: "camara-lei-8112-provimento",
      lessons: 25,
      level: "intermediate",
      name: "Aplicar regras de provimento e movimentação",
      prerequisiteIds: ["camara-agentes-vinculos-requisicao"],
    },
    {
      description:
        "Aplicar as disposições da Lei 8.112/1990 sobre direitos, vantagens, licenças, deveres e proibições dos servidores federais.",
      id: "camara-lei-8112-direitos-deveres",
      lessons: 26,
      level: "intermediate",
      name: "Aplicar direitos e deveres dos servidores federais",
      prerequisiteIds: ["camara-agentes-vinculos-requisicao"],
    },
    {
      description:
        "Reconhecer fontes e princípios do direito disciplinar e distinguir ilícitos, responsabilidades e sanções administrativas.",
      id: "camara-ilicito-disciplinar",
      lessons: 20,
      level: "intermediate",
      name: "Analisar ilícitos e sanções disciplinares",
      prerequisiteIds: ["camara-lei-8112-direitos-deveres"],
    },
    {
      description:
        "Distinguir procedimentos disciplinares e aplicar suas etapas, garantias, prazos e possíveis resultados.",
      id: "camara-procedimentos-disciplinares",
      lessons: 25,
      level: "intermediate",
      name: "Aplicar regras dos procedimentos disciplinares",
      prerequisiteIds: ["camara-ilicito-disciplinar"],
    },
    {
      description:
        "Aplicar os princípios e as regras de tramitação, decisão, recursos e revisão da Lei 9.784/1999.",
      id: "camara-processo-administrativo-federal",
      lessons: 22,
      level: "intermediate",
      name: "Aplicar a Lei do Processo Administrativo Federal",
      prerequisiteIds: ["camara-atos-administrativos"],
    },
    {
      description:
        "Julgar a responsabilidade estatal por ação ou omissão, seus requisitos e causas de exclusão ou atenuação.",
      id: "camara-responsabilidade-civil-estado",
      lessons: 26,
      level: "intermediate",
      name: "Analisar a responsabilidade civil do Estado",
      prerequisiteIds: ["camara-estado-governo-administracao"],
    },
    {
      description:
        "Aplicar a Lei 8.429/1992 a atos de improbidade, seus requisitos, sanções e procedimentos.",
      id: "camara-improbidade-administrativa",
      lessons: 24,
      level: "intermediate",
      name: "Julgar atos de improbidade administrativa",
      prerequisiteIds: ["camara-principios-administracao-publica"],
    },
    {
      description:
        "Aplicar os princípios, finalidades, modalidades e hipóteses de contratação direta da Lei 14.133/2021.",
      id: "camara-licitacoes-lei-14133",
      lessons: 27,
      level: "intermediate",
      name: "Aplicar regras de licitações e contratação direta",
      prerequisiteIds: ["camara-principios-administracao-publica"],
    },
    {
      description:
        "Distinguir as funções e os elementos do estudo técnico preliminar e do termo de referência no planejamento da contratação.",
      id: "camara-planejamento-contratacao-etp-tr",
      lessons: 21,
      level: "intermediate",
      name: "Analisar estudo técnico e termo de referência",
      prerequisiteIds: ["camara-licitacoes-lei-14133"],
    },
    {
      description:
        "Aplicar a Lei 12.527/2011 a pedidos de informação, transparência e restrições legais de acesso.",
      id: "camara-lei-acesso-informacao",
      lessons: 20,
      level: "intermediate",
      name: "Aplicar a Lei de Acesso à Informação",
      prerequisiteIds: [],
    },
    {
      description:
        "Aplicar os princípios, bases legais, direitos e regras de tratamento de dados pessoais da Lei 13.709/2018.",
      id: "camara-lei-protecao-dados-pessoais",
      lessons: 23,
      level: "intermediate",
      name: "Aplicar a Lei Geral de Proteção de Dados",
      prerequisiteIds: [],
    },
    {
      description:
        "Aplicar as regras sobre características, formalização, gestão e fiscalização de contratos administrativos e atribuições do fiscal.",
      id: "camara-contratos-gestao-fiscalizacao",
      lessons: 27,
      level: "intermediate",
      name: "Analisar contratos e fiscalização contratual",
      prerequisiteIds: ["camara-licitacoes-lei-14133"],
    },
  ],
};

/** The AL-CE Técnico Legislativo graph (nível médio) from the same run. */
export const ALCE_TECNICO_PORTUGUESE: LibraryCourse = {
  courseTitle: "Língua Portuguesa",
  skills: [
    {
      description:
        "Identificar informações explícitas, inferências e sentidos de palavras no contexto de textos.",
      id: "alce-tecnico-compreender-textos",
      lessons: 25,
      level: "intermediate",
      name: "Interpretar textos e inferir sentidos",
      prerequisiteIds: [],
    },
    {
      description:
        "Identificar teses, argumentos, pressupostos e relações entre razões e conclusões em textos.",
      id: "alce-tecnico-analisar-argumentacao",
      lessons: 25,
      level: "intermediate",
      name: "Analisar a argumentação em textos",
      prerequisiteIds: ["alce-tecnico-compreender-textos"],
    },
    {
      description:
        "Examinar a progressão das ideias e os efeitos de referentes, conectivos e substituições na unidade do texto.",
      id: "alce-tecnico-coerencia-coesao",
      lessons: 25,
      level: "intermediate",
      name: "Analisar coerência e coesão textuais",
      prerequisiteIds: ["alce-tecnico-compreender-textos"],
    },
    {
      description:
        "Distinguir tipos e gêneros textuais por suas características, finalidades e organização.",
      id: "alce-tecnico-tipos-generos-textuais",
      lessons: 20,
      level: "intermediate",
      name: "Reconhecer tipos e gêneros textuais",
      prerequisiteIds: ["alce-tecnico-compreender-textos"],
    },
    {
      description:
        "Julgar a grafia e a acentuação de palavras segundo as regras ortográficas vigentes.",
      id: "alce-tecnico-ortografia-acentuacao",
      lessons: 20,
      level: "intermediate",
      name: "Aplicar regras de ortografia e acentuação",
      prerequisiteIds: [],
    },
    {
      description:
        "Analisar classes de palavras e funções sintáticas dos termos da oração para julgar construções e reescritas.",
      id: "alce-tecnico-classes-termos-oracao",
      lessons: 35,
      level: "intermediate",
      name: "Analisar classes e termos da oração",
      prerequisiteIds: [],
    },
    {
      description:
        "Distinguir orações coordenadas e subordinadas e interpretar suas relações sintáticas e semânticas.",
      id: "alce-tecnico-coordenacao-subordinacao",
      lessons: 30,
      level: "intermediate",
      name: "Analisar coordenação e subordinação",
      prerequisiteIds: ["alce-tecnico-classes-termos-oracao"],
    },
    {
      description:
        "Julgar o emprego de tempos, modos e vozes verbais e as flexões nominais e verbais em contexto.",
      id: "alce-tecnico-verbos-flexoes",
      lessons: 25,
      level: "intermediate",
      name: "Analisar verbos e flexões em contexto",
      prerequisiteIds: ["alce-tecnico-classes-termos-oracao"],
    },
    {
      description: "Aplicar as regras de concordância nominal e verbal a frases e reescritas.",
      id: "alce-tecnico-concordancia-nominal-verbal",
      lessons: 25,
      level: "intermediate",
      name: "Aplicar concordância nominal e verbal",
      prerequisiteIds: ["alce-tecnico-classes-termos-oracao"],
    },
    {
      description:
        "Julgar a regência de nomes e verbos e a ocorrência de crase em construções e reescritas.",
      id: "alce-tecnico-regencia-crase",
      lessons: 30,
      level: "intermediate",
      name: "Aplicar regência nominal, verbal e crase",
      prerequisiteIds: ["alce-tecnico-classes-termos-oracao"],
    },
    {
      description:
        "Julgar o emprego e a alteração de sinais de pontuação conforme a sintaxe e os efeitos de sentido.",
      id: "alce-tecnico-pontuacao-sintaxe",
      lessons: 25,
      level: "intermediate",
      name: "Analisar pontuação e efeitos de sentido",
      prerequisiteIds: ["alce-tecnico-coordenacao-subordinacao"],
    },
    {
      description:
        "Reconhecer características, padrões de linguagem e formas de tratamento da correspondência oficial.",
      id: "alce-tecnico-correspondencia-oficial",
      lessons: 15,
      level: "intermediate",
      name: "Analisar padrões de correspondência oficial",
      prerequisiteIds: [],
    },
  ],
};
