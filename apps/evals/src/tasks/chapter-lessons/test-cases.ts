const SHARED_EXPECTATIONS = `
  # Goal

  Evaluate whether the result is a usable lesson plan for the requested chapter.

  A strong lesson plan turns the chapter scope into cohesive learner capabilities. Each lesson should be large enough to support its own explanation lessons, practice, quiz, and review without repeating neighboring lessons. Coverage matters, but only when the lesson boundaries would produce a good learning experience in this product.

  # What Good Looks Like

  - Lessons are capability-sized: each one teaches a distinct mechanism, decision, artifact, workflow, or real learner move.
  - Related concepts that are mutually defining stay together in one lesson.
  - The plan covers the chapter's canonical fundamentals, important modern practice, and required named entities from the domain.
  - Lessons stay inside this chapter's scope and avoid concepts that primarily belong to neighboring chapters.
  - Titles are concrete and learner-facing, not dry textbook categories.
  - Descriptions explain what the learner will do or be able to reason through.
  - Concepts are specific enough to guide content generation, but they are raw material inside a lesson, not automatic lesson candidates.

  # Major Failures

  ## False Granularity

  False granularity is the main failure this eval must catch. It happens when the output looks comprehensive because it split the chapter into many tiny lessons, but those lessons would generate repetitive lessons.

  Use this test: if the explanation or practice for lesson A must teach lesson B's core idea for lesson A to make sense, A and B should probably be one lesson.

  Penalize as a major failure when the output:

  - splits one input -> process -> result chain into separate lessons
  - splits first-exposure parts that define each other, such as variable/name/value/output, function declaration/call/parameter/return, or loop/condition/body
  - creates many adjacent lessons that would use the same example with slightly different labels
  - turns every method, subtopic, phase, or label into its own lesson even though the learner experience would be repetitive
  - rewards glossary completeness over teachable lesson boundaries

  Do not confuse false granularity with valid domain decomposition. Adjacent lessons can be separate when they teach different evidence types, interpretive tasks, mechanisms, source categories, workflows, or real-world decisions. Examples that can be valid:

  - history lessons that use artifacts, landscapes, languages, trade goods, rituals, warfare, and diplomacy for different kinds of historical reasoning
  - astronomy lessons that separate detection methods, signal validation, physical inference, atmospheric characterization, habitability, missions, and telescope capabilities
  - law lessons that separate procedural moves with different legal effects, deadlines, parties, remedies, or courts
  - technical lessons that separate mechanisms only when each can be practiced without re-teaching the neighboring mechanism

  Named-entity lessons are not automatically false granularity. They are valid when the named people, sites, missions, models, cases, tools, or works anchor a distinct comparison, interpretation, evidence source, or practical decision. Penalize them as false granularity only when the lesson is mostly a memorization list or would repeat the same teaching move as a neighboring lesson.

  Score caps:

  - Clear false-granularity cluster: \`majorErrors\` score must be 7.5 or lower.
  - Repeated false granularity across the output, after excluding valid domain decomposition: \`majorErrors\` score must be 6.5 or lower.
  - Glossary-expanded syllabus where many lessons are too small to support distinct lessons: \`majorErrors\` score must be 6.5 or lower.

  ## Coverage, Accuracy, and Scope

  Penalize as major failures when the output:

  - misses canonical chapter pillars or modern practices a serious learner needs
  - omits important named entities in domains built around specific people, tools, missions, models, works, groups, cases, or landmark systems
  - includes factual, historical, legal, scientific, technical, or linguistic errors
  - drifts into neighboring-chapter material as lesson topics rather than brief context
  - uses mostly dry textbook headings that feel like a table of contents instead of learner-facing actions or outcomes

  # Minor Issues

  Treat these as minor unless they make the lesson plan hard to use:

  - isolated awkward title wording
  - concept titles that are slightly broad, abstract, verbose, or compound
  - lesson sizes that are uneven or mechanically uniform when the boundaries are otherwise sound
  - small progression or phrasing issues
  - small scope-adjacent mentions that do not become lesson topics

  # Scoring Order

  First check whether the lesson boundaries would produce distinct, non-repetitive learning arcs. Then check coverage, accuracy, scope, and title quality. Do not reward extra length, exhaustive lists, or high concept count by themselves.

  If the output has no concrete major failures, the \`majorErrors\` conclusion should be "None" and the score should be 10.
`;

export const TEST_CASES = [
  // Initial chapter: beginner-level programming
  {
    expectations: `
      - MUST be in US English
      - JavaScript-specific false-granularity check: separate adjacent lessons for calling a function, passing data into a function, returning a result, and choosing a function shape are over-split. Those ideas are mutually defining parts of using functions and should mostly be one cohesive lesson, or at most a very small number of lessons. If you see this pattern, the \`majorErrors\` score must be 6.5 or lower.
      - Do not reward this case for adding many narrow lessons about every array/object method or function subtopic. The lesson list should feel like teachable learner capabilities, not a glossary expanded into a syllabus.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-functions-arrays-objects",
    userInput: {
      chapterDescription:
        "Break code into reusable pieces, return results, and manage data with arrays and objects. You begin writing code that stays readable as it grows.",
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Start by making a tiny program that reacts to a click, changes text on the page, and keeps score. You touch real JavaScript right away: variables, functions, events, and the browser console.",
          title: "Make a Click Counter",
        },
        {
          description:
            "Write values, combine them, compare them, and control what happens next. This chapter builds the core habits behind almost every JavaScript program.",
          title: "Values, Conditions, and Repetition",
        },
        {
          description:
            "Use the DOM to read page content, change styles, create elements, and respond to user actions. This is the bridge from small scripts to real browser behavior.",
          title: "Changing a Web Page with JavaScript",
        },
        {
          description:
            "Handle forms, validate input, save data in the browser, and build interactions that feel complete to a user. The work here looks much closer to everyday front-end tasks.",
          title: "Forms, Validation, and Local Storage",
        },
      ],
    },
  },
  // Early chapter: beginner-level computer science from GPT-5.5 course-chapters output
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Ciência da Computação-specific false-granularity check: separate adjacent lessons for declaring a function, naming it, calling it, passing inputs, returning values, and reusing code are over-split. Those ideas are mutually defining parts of using functions to organize code and should mostly be one cohesive lesson, or at most a very small number of lessons. If you see this pattern, the \`majorErrors\` score must be 6.5 or lower.
      - Keep this chapter focused on functions as a programming organization tool. Do not drift into collections, files, Git, testing, or debugging except as brief context because neighboring chapters own those topics.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ciencia-da-computacao-funcoes-que-organizam-o-codigo",
    userInput: {
      chapterDescription:
        "Funções ajudam a dividir um programa em pedaços menores, dar nomes claros às tarefas e reutilizar código. Você pratica transformar código repetido em partes testáveis.",
      chapterTitle: "Funções que organizam o código",
      courseTitle: "Ciência da Computação",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Variáveis, tipos simples, entrada, saída e expressões aparecem em problemas pequenos: converter temperatura, somar uma conta e formatar uma mensagem. Você passa a guardar dados e usá-los sem mistério.",
          title: "Valores, textos e contas",
        },
        {
          description:
            "Condições e laços entram em tarefas reais, como validar uma senha, repetir tentativas e percorrer uma lista de itens. Você começa a controlar o caminho que o programa segue.",
          title: "Decisões e repetições",
        },
        {
          description:
            "Listas, mapas, registros e arquivos aparecem em pequenos cadastros e relatórios. Você passa a guardar coleções de dados, buscar informações e salvar resultados fora do programa.",
          title: "Coleções e arquivos",
        },
        {
          description:
            "Erros de sintaxe, falhas em tempo de execução e respostas erradas são tratados com leitura de mensagens, depurador e testes manuais. Você ganha um método para consertar código sem depender de adivinhação.",
          title: "Caçando bugs sem pânico",
        },
      ],
    },
  },
  // Initial chapter: beginner-level humanities
  {
    expectations: `
      - MUST be in US English (proper nouns of Brazilian institutions and places remain in Portuguese)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-indigenous-before-colonization",
    userInput: {
      chapterDescription:
        "This chapter follows the many peoples already living in the land before 1500, including language families, trade networks, farming, warfare, and belief systems. It also shows how archaeologists, oral traditions, and colonial records help rebuild histories that were often erased.",
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Start with a close look at the letter Pero Vaz de Caminha wrote in 1500 and other early accounts of first contact. The learner works with real words from the period to spot power, curiosity, religion, trade, and misunderstanding at the beginning of Brazil's written history.",
          title: "Reading the First Portuguese Accounts",
        },
        {
          description:
            "See how Portugal claimed, mapped, and tried to control the territory through captaincies, forts, missions, and coastal settlements. The chapter connects imperial policy with the hard realities of distance, labor, and resistance on the ground.",
          title: "Claiming and Settling the Colony",
        },
        {
          description:
            "Sugar mills, enslaved labor, Atlantic shipping, and merchant credit turned colonial Brazil into a major plantation zone. This chapter shows how the sugar economy worked day to day and how wealth and violence were built together.",
          title: "Sugar, Land, and the Atlantic System",
        },
        {
          description:
            "This chapter centers the forced migration of Africans, the slave trade, labor regimes, family formation, religion, revolt, and cultural survival. It treats slavery as a core structure of Brazilian history, not a side topic.",
          title: "Slavery and African Diaspora in Brazil",
        },
      ],
    },
  },
  // Mid-course chapter: focused Kanban method depth from GPT-5.5 course-chapters output
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Kanban-specific false-granularity check: separate adjacent lessons for lead time, cycle time, throughput, WIP, and item age are over-split when they only teach isolated definitions. These metrics form one flow-measurement toolkit and should be grouped by learner use, such as reading flow health, diagnosing bottlenecks, or asking better forecasting questions. If the output creates one glossary lesson per metric, the \`majorErrors\` score must be 6.5 or lower.
      - Do not penalize separate lessons for genuinely different learner moves, such as choosing which metric answers a question, spotting a bottleneck, or using measurements without pressuring people.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-metricas-de-fluxo-que-ajudam",
    userInput: {
      chapterDescription:
        "Lead time, cycle time, throughput, WIP e idade do item mostram como o fluxo se comporta. Você usa essas medidas para fazer perguntas melhores, não para pressionar pessoas.",
      chapterTitle: "Métricas de fluxo que ajudam",
      courseTitle: "Kanban",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Políticas explícitas dizem quando um cartão entra, muda de coluna, bloqueia ou está pronto. Isso reduz discussão escondida e deixa o sistema mais justo para o time.",
          title: "Regras claras para mover cartões",
        },
        {
          description:
            "Nem todo pedido deve entrar direto no quadro. Você cria uma fila de entrada, separa ideias de compromissos e decide o que puxar com base em capacidade real.",
          title: "Reabastecimento e priorização",
        },
        {
          description:
            "Diagramas de fluxo cumulativo, dispersão de cycle time e gráficos de envelhecimento mostram padrões que a opinião não revela. Você lê esses gráficos para detectar filas crescendo, variação alta e risco de atraso.",
          title: "Gráficos que contam a história do fluxo",
        },
        {
          description:
            "Kanban trabalha melhor com probabilidade do que com promessas rígidas. Você usa percentis, SLE e simulações simples de Monte Carlo para responder perguntas como “quando isso provavelmente fica pronto?”.",
          title: "Previsão sem chute",
        },
      ],
    },
  },
  // Mid-course chapter: mid-level domain depth
  {
    expectations: `
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-processo-civil",
    userInput: {
      chapterDescription:
        "Cobre princípios processuais, competência, partes, atos processuais, provas, tutelas, sentença e recursos no processo civil. É a espinha dorsal para transformar direitos em pedidos eficazes perante o Judiciário.",
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Apresenta tributos, competências, limitações ao poder de tributar, obrigação tributária, lançamento, crédito e defesa do contribuinte. Conecta a teoria tributária à vida de pessoas, empresas e governo.",
          title: "Direito Tributário",
        },
        {
          description:
            "Trabalha vínculo de emprego, jornada, salário, férias, FGTS, rescisão, negociação coletiva e rotina das relações de trabalho. Mostra como prevenir passivos e lidar com conflitos trabalhistas.",
          title: "Direito do Trabalho",
        },
        {
          description:
            "Mostra inquérito, ação penal, crimes, penas, provas, garantias e recursos no processo penal. Dá base para atuar com acusação, defesa e controle da legalidade da persecução penal.",
          title: "Direito Penal e Processo Penal",
        },
        {
          description:
            "Apresenta proteção ao consumidor, oferta, publicidade, vício, defeito, responsabilidade do fornecedor e tutela coletiva. Mostra um dos campos mais presentes no dia a dia forense e consultivo.",
          title: "Direito do Consumidor",
        },
      ],
    },
  },
  // Mid-course chapter: biology mechanism from GPT-5.5 course-chapters output
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Biology-specific false-granularity check: separate adjacent lessons for DNA, RNA, genes, chromosomes, and proteins are over-split when they only define labels in the same information-flow mechanism. This chapter should teach how molecular information becomes a protein and then a trait, not turn each molecule name into a separate mini-lesson. If the output creates a glossary-expanded syllabus around those labels, the \`majorErrors\` score must be 6.5 or lower.
      - Do not penalize separate lessons for genuinely different mechanisms inside the flow, such as transcription, translation, genetic code, or how protein structure affects traits, when each lesson can be explained and practiced without re-teaching the others from scratch.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-do-dna-a-proteina",
    userInput: {
      chapterDescription:
        "DNA, RNA, genes, cromossomos e proteínas são conectados pelo fluxo de informação dentro da célula. O capítulo mostra como uma sequência molecular pode virar uma característica observável.",
      chapterTitle: "Do DNA à proteína",
      courseTitle: "Biologia",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Enzimas, ATP, respiração celular e fermentação são explicadas pelo caminho da energia nos seres vivos. Exemplos incluem músculo em esforço, fermento produzindo gás e células usando alimento.",
          title: "Como a célula obtém energia",
        },
        {
          description:
            "Cloroplastos, luz, pigmentos, gás carbônico e produção de açúcar entram em uma sequência clara. Você liga fotossíntese a plantas, algas, cadeias alimentares e atmosfera.",
          title: "Folhas que capturam luz",
        },
        {
          description:
            "Mitose, meiose, fecundação e separação de cromossomos aparecem por meio de desenhos, cariótipos e casos simples. Você vê como células mantêm ou embaralham informação genética.",
          title: "Células se dividindo",
        },
        {
          description:
            "Cruzamentos simples, alelos dominantes e recessivos, heredogramas e probabilidade genética entram com exemplos de plantas, animais e famílias. O foco é prever padrões sem tratar genética como destino fixo.",
          title: "Hereditariedade em famílias e linhagens",
        },
      ],
    },
  },
  // Late chapter: expert-level scientific depth
  {
    expectations: `
      - MUST be in Latin American Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-astronomia-exoplanetas",
    userInput: {
      chapterDescription:
        "Seguirás la revolución de los exoplanetas: métodos de detección, tránsito, velocidad radial, atmósferas y búsqueda de mundos habitables. También revisarás qué pueden y qué no pueden decir hoy los datos sobre vida fuera de la Tierra.",
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      neighboringChapters: [
        {
          description:
            "Estudiarás el gran cambio reciente de la disciplina: detección de ondas gravitacionales, qué eventos las producen y cómo se combinan con señales de luz. Verás cómo nació la astronomía multimensajero y qué problemas permitió resolver.",
          title: "Ondas gravitacionales",
        },
        {
          description:
            "Verás otro pilar nuevo: neutrinos cósmicos, rayos cósmicos y cómo se conectan con explosiones, agujeros negros y objetos extremos. Este capítulo completa la visión moderna del universo observada con mensajeros no tradicionales.",
          title: "Neutrinos y partículas del cosmos",
        },
        {
          description:
            "Aquí aparecen las grandes encuestas del cielo, la astronomía de datos y el uso actual de IA para clasificar, detectar anomalías y manejar volúmenes masivos de observaciones. Es ya parte normal de la práctica moderna, no un tema opcional.",
          title: "Astronomía de datos e inteligencia artificial",
        },
        {
          description:
            "Verás cómo se diseña y ejecuta una investigación astronómica completa: pregunta, propuesta de observación, toma de datos, reducción, análisis, interpretación y publicación. Esto une la teoría con la práctica real de la disciplina.",
          title: "De una pregunta a un resultado científico",
        },
      ],
    },
  },
  // Late chapter: expert-level technical depth
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-machine-learning-transformers",
    userInput: {
      chapterDescription:
        "Transformers changed how ML handles language, vision, audio, and multimodal data. This chapter covers attention, encoder-decoder designs, pretraining patterns, and why transformers replaced many older architectures.",
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Models in production need packaging, serving, scaling, rollback plans, observability, and incident handling. This chapter covers deployment patterns for batch, streaming, and real-time inference.",
          title: "Serving Models",
        },
        {
          description:
            "Once models are live, teams need monitoring, retraining rules, feature stores, lineage, governance, and automation. This chapter covers the operational side of ML systems that people now call MLOps.",
          title: "MLOps",
        },
        {
          description:
            "Foundation models and large language models created new ways to build products and research systems. This chapter covers prompting, context windows, tool use, evaluation, and the strengths and limits of LLM-based systems.",
          title: "Large Language Models",
        },
        {
          description:
            "Many modern applications improve LLMs by connecting them to external knowledge. This chapter covers embeddings, chunking, indexing, retrieval, reranking, grounding, and failure modes in retrieval-augmented generation systems.",
          title: "RAG Systems",
        },
      ],
    },
  },
];
