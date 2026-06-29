const SHARED_EXPECTATIONS = `
  # Goal

  Evaluate whether the result is a usable lesson plan for the requested chapter.

  A strong lesson plan turns the chapter scope into small, self-contained learner capabilities. Each lesson should teach one clear topic or skill: the core explanation should fit in 1-2 minutes, roughly 700-1,500 characters including spaces. The follow-up practice should fit in 3-4 minutes because it focuses on the same small capability. Coverage and lesson size both matter: splitting overloaded lessons should create more focused lessons, not a thinner chapter.

  The app adds one practice lesson after each explanation, quizzes after every two practices, and a final quiz before review. The generated lesson plan should still return only substantive lessons that teach new content, not practice, quiz, review, summary, or capstone lessons.

  # What Good Looks Like

  - Lessons are compact and practice-sized: each one teaches a distinct mechanism, decision, artifact, workflow, evidence type, practical task, or structural role as one self-contained unit.
  - Each lesson can be explained clearly in 1-2 minutes, roughly 700-1,500 characters including spaces. If it would need several explanations, it should be split into multiple lessons.
  - Related concepts that are mutually defining stay together in one lesson only when splitting them would force the same explanation and practice to repeat.
  - The plan covers the chapter's canonical fundamentals, important modern practice, and required named entities from the domain.
  - Splitting an overloaded lesson preserves the rest of the chapter's coverage instead of spending the whole plan on the first mechanism.
  - Lessons stay inside this chapter's scope and avoid concepts that primarily belong to neighboring chapters.
  - Titles are concrete, learner-facing, and searchable. Use the canonical names a serious learner would expect when those names are the field-standard way to identify the lesson topic.
  - Descriptions explain what the lesson teaches and what the learner will do or be able to reason through. They should name the actual lesson scope in plain, searchable terms.
  - Concepts are specific enough to guide content generation, but they are raw material inside a lesson, not automatic lesson candidates.

  # Major Failures

  ## Overloaded Lessons

  Overloaded lessons are the main failure this eval must now catch. They happen when the output hides too much inside one umbrella lesson, producing explanations and practices that take too long for learners to complete.

  A lesson may briefly mention neighboring pieces for context. Do not treat that as a reason to merge several distinct lesson targets. Merge only when the learner cannot understand or practice one part without learning the other part's core mechanism too.

  Penalize as a major failure when the output:

  - combines multiple independent chapter pillars into one lesson
  - makes one lesson responsible for several mechanisms, workflows, decisions, structures, or roles that can be learned without re-teaching each other
  - hides a sequence of distinct parts inside one title, such as "trace X from input to output," when each part has a different function or recognition task
  - depends on vague wording to fit a lesson that would actually need more than 1-2 minutes to explain clearly
  - uses vague umbrella titles to avoid making necessary lesson boundaries
  - creates lessons that would need several separate explanations to teach clearly

  Score caps:

  - Clear overloaded umbrella lesson: \`majorErrors\` score must be 7.5 or lower.
  - Repeated overloaded lessons across the output: \`majorErrors\` score must be 6.5 or lower.
  - A lesson that would plausibly create a 7+ minute explanation or a 10+ minute practice because it combines several independently teachable concepts: \`majorErrors\` score must be 6.5 or lower.

  ## False Granularity

  False granularity is the opposite boundary failure. It happens when the output looks comprehensive because it split the chapter into many tiny lessons, but those lessons would repeat the same explanation.

  Use this test: if the explanation or practice for lesson A must teach lesson B's core idea for lesson A to make sense, A and B should probably be one lesson.

  Canonical/searchable names do not make every named concept an automatic lesson. Judge whether the generated lesson would produce a distinct explanation and practice, not whether the title contains a recognizable term.

  Penalize as a major failure when the output:

  - splits one simple input -> process -> result chain into separate lessons when all parts use the same example and practice move
  - splits small first-exposure parts that define each other, such as variable/name/value/output, function declaration/call/parameter/return, or loop/condition/body
  - creates many adjacent lessons that would use the same example with slightly different labels
  - turns every method, subtopic, phase, or label into its own lesson even though the learner experience would be repetitive
  - rewards glossary completeness over teachable lesson boundaries

  Do not confuse false granularity with valid domain decomposition. Adjacent lessons can be separate when they teach different evidence types, interpretive tasks, mechanisms, source categories, workflows, or real-world decisions. Examples that can be valid:

  - history lessons that use artifacts, landscapes, languages, trade goods, rituals, warfare, and diplomacy for different kinds of historical reasoning
  - astronomy lessons that separate detection methods, signal validation, physical inference, atmospheric characterization, habitability, missions, and telescope capabilities
  - law lessons that separate procedural moves with different legal effects, deadlines, parties, remedies, or courts
  - technical lessons that separate mechanisms only when each can be practiced without re-teaching the neighboring mechanism
  - compact comparison lessons that group related variants, metrics, methods, or syntax forms around one learner move, such as comparing tradeoffs, choosing the right tool, or reading the same kind of evidence

  Named-entity lessons are not automatically false granularity. They are valid when the named people, sites, missions, models, cases, tools, or works anchor a distinct comparison, interpretation, evidence source, or practical decision. Penalize them as false granularity only when the lesson is mostly a memorization list or would repeat the same teaching move as a neighboring lesson.

  Score caps:

  - Clear false-granularity cluster: \`majorErrors\` score must be 7.5 or lower.
  - Repeated false granularity across the output, after excluding valid domain decomposition: \`majorErrors\` score must be 6.5 or lower.
  - Glossary-expanded syllabus where many lessons are too small to stand as distinct self-contained units: \`majorErrors\` score must be 6.5 or lower.

  ## Coverage, Accuracy, and Scope

  Penalize as major failures when the output:

  - drops important chapter pillars because the lessons became smaller
  - misses canonical chapter pillars or modern practices a serious learner needs
  - omits important named entities in domains built around specific people, tools, missions, models, works, groups, cases, or landmark systems
  - includes factual, historical, legal, scientific, technical, or linguistic errors
  - drifts into neighboring-chapter material as lesson topics rather than brief context
  - uses mostly bloated textbook headings, generic category labels, or abstract inventory titles that do not identify a teachable lesson target

  ## Canonical Lesson Titles and Descriptions

  Lesson titles should preserve canonical/searchable names for the specific mechanism, structure, method, artifact, case, source type, procedure, metric, tool, or concept being taught. Canonical names are not "dry textbook headings" when they are the terms learners search for and practitioners use.

  Accept close field-standard variants in the requested language. Do not require exact wording when the title still names the recognized topic.

  Penalize as a major style issue when the output hides canonical terms behind practical paraphrases, metaphors, slogans, or "what this does" titles. A learner scanning or searching for a standard topic should be able to recognize the lesson from the title.

  Examples:

  - "Function parameters and return values" is better than "Send data in and get an answer back"
  - "Array methods" is better than "Use lists without extra loops"
  - "Axon hillock" is better than "Where a neuron decides to fire"
  - "Lead time and cycle time" is better than "How long work really takes"
  - "Tutelas provisórias" is better than "Pedidos urgentes antes da sentença"
  - "Transcrição" is better than "Copiar informação para RNA"
  - "Transit method" is better than "Watch a planet dim a star"
  - "Self-attention" is better than "Let tokens look at each other"

  Score caps:

  - If 3 or more lesson titles hide important canonical/searchable terms that belong in those titles, the \`majorErrors\` score must be 7 or lower even when descriptions mention the terms and the lesson boundaries are otherwise sound.
  - If 1-2 important lesson titles hide canonical/searchable terms, the \`majorErrors\` score must be 8 or lower.
  - Descriptions recovering the canonical term do not remove the title problem because learners scan and search lesson titles first.

  Descriptions should name the actual lesson scope clearly enough that downstream generation can tell which specific concept, procedure, evidence type, example, or skill belongs inside the lesson. A description that only says what the learner will feel, broadly do, or "understand" is too vague if it does not name the lesson's concrete scope in plain, searchable terms.

  # Minor Issues

  Treat these as minor unless they make the lesson plan hard to use:

  - isolated awkward title wording
  - concept titles that are slightly broad, abstract, verbose, or compound
  - a compact comparison lesson that names several closely related variants when it only teaches recognition, tradeoffs, or selection criteria
  - lesson sizes that are uneven or mechanically uniform when the boundaries are otherwise sound
  - small progression or phrasing issues
  - small scope-adjacent mentions that do not become lesson topics

  # Scoring Order

  First check whether the output preserves the requested chapter coverage. Then check whether the lesson boundaries would produce short, distinct, non-repetitive lessons. Do not reward extra length, exhaustive lists, or high concept count by themselves, but also do not reward a short plan that became short by dropping core chapter pillars.

  If the output has no concrete major failures, the \`majorErrors\` conclusion should be "None" and the score should be 10.
`;

export const TEST_CASES = [
  // Initial chapter: beginner-level programming
  {
    expectations: `
      - MUST be in US English
      - JavaScript-specific false-granularity check: separate lessons for function declarations/calls, parameters/arguments, return values, function expressions, arrow functions, and choosing syntax are a major issue only when they become a glossary-expanded syntax tour where the lessons would reuse the same small function example with different labels. If the output repeatedly isolates mutually defining function mechanics without distinct learner moves, the \`majorErrors\` score must be 7.5 or lower; if most of the plan has that repetitive shape, it must be 6.5 or lower.
      - Do not automatically penalize beginner scaffolding that separates parameters, return values, default parameters, function expressions, or arrow functions when each lesson has a distinct practice target and would not force the same explanation to repeat.
      - Do not reward this case for adding many narrow lessons about every function syntax variant or parameter subtopic. The lesson list should feel like teachable learner capabilities, not a glossary expanded into a syllabus.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-functions-parameters-return-values",
    userInput: {
      chapterDescription:
        "Covers function declarations, function expressions, parameters, return values, default parameters, and arrow functions. You will organize repeated work into reusable pieces.",
      chapterTitle: "Functions, parameters, and return values",
      courseTitle: "JavaScript",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Covers if, else, switch, loops, break, continue, and choosing the right control structure. You will turn simple rules into working program behavior.",
          title: "Control flow",
        },
        {
          description:
            "Covers block scope, function scope, lexical scope, closures, and hoisting. You will see why variables are visible in some places and hidden in others.",
          title: "Scope, closures, and hoisting",
        },
        {
          description:
            "Covers arrays, indexes, length, push, pop, slice, splice, for...of, forEach, map, filter, reduce, and sorting. You will process lists of real data without repeating yourself.",
          title: "Arrays and iteration",
        },
        {
          description:
            "Covers object literals, properties, methods, nested objects, optional property access, and object comparison. You will model people, orders, settings, and other everyday records in code.",
          title: "Objects and property access",
        },
      ],
    },
  },
  // Initial chapter: beginner-level neuroscience with overloaded neuron-path risk
  {
    expectations: `
      - MUST be in US English
      - Neuroscience-specific overload check: do not accept a single lesson that talks about dendrites, soma, axon hillock, axon, myelin, nodes of Ranvier, and terminals all at once. Each of those should probably be its own lesson because each structure has a distinct role and recognition task. If the output combines most of those structures into one umbrella lesson, the \`majorErrors\` score must be 6.5 or lower.
      - Do not apply the JavaScript-style collapse rule to this case. A biological signal path can be split when each structure performs a distinct job that can be explained independently with only brief context from neighboring structures.
      - Coverage check: after splitting the neuron-path lesson, the plan must still cover the rest of this chapter. It should include neuron shapes matched to jobs, glial cell roles, how gray matter, white matter, nerves, and ganglia are built from cell parts, what stains and microscopes reveal, and how to choose evidence for a cell-level claim. If the output mostly covers dendrites/soma/axon parts and drops those pillars, the \`majorErrors\` score must be 6.5 or lower.
      - Keep this chapter focused on the cells and cell parts that build the nervous system. It may include neurons, dendrites, soma, axon hillock, axons, myelin, nodes of Ranvier, terminals, neuron shapes, glial support roles, tissue organization, microscopy evidence, and cell-level evidence claims, but it should not drift into brain regions, full neural circuits, learning, psychiatric disorders, or detailed neurotransmitter pharmacology except as brief context.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-neuroscience-neurons-glia-and-nervous-tissue",
    userInput: {
      chapterDescription:
        "Neurons, glial cells, dendrites, soma, axon hillock, axons, myelin, nodes of Ranvier, terminals, neuron shapes, gray matter, white matter, nerves, ganglia, stains, microscopes, and cell-level evidence form the cellular toolkit of the nervous system. The learner identifies what each part does without turning the whole neuron into one overloaded lesson.",
      chapterTitle: "Neurons, glia, and nervous tissue",
      courseTitle: "Neuroscience",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Start with the big map: brain, spinal cord, peripheral nerves, sensory systems, movement, and behavior. The learner learns what neuroscience studies before zooming into cells.",
          title: "Nervous system anatomy and function",
        },
        {
          description:
            "Work through synapses, neurotransmitters, receptors, reuptake, and how chemical messages change the next cell. This chapter takes over after the signal reaches the terminal.",
          title: "Synapses and neurotransmitters",
        },
        {
          description:
            "Connect groups of neurons into circuits for reflexes, sensation, movement, memory, and emotion. The focus shifts from one cell to network behavior.",
          title: "Neural circuits and behavior",
        },
        {
          description:
            "See how repeated activity changes synapses and circuits through plasticity. The learner connects cellular change to learning, adaptation, and recovery.",
          title: "Neuroplasticity",
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
    id: "pt-ciencia-da-computacao-funcoes-modulos-organizacao-codigo",
    userInput: {
      chapterDescription:
        "Mostra como dividir programas em funções, módulos e pacotes. Você transforma scripts soltos em código reutilizável, legível e mais fácil de testar.",
      chapterTitle: "Funções, módulos e organização de código",
      courseTitle: "Ciência da Computação",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Cobre variáveis, tipos simples, entrada e saída, condições e laços usando Python. Você cria programas pequenos que resolvem problemas reais e produzem resultados verificáveis.",
          title: "Programação imperativa com Python",
        },
        {
          description:
            "Ensina a encontrar erros com leitura de mensagens, prints controlados, depuradores e casos mínimos. Você pratica corrigir falhas sem adivinhar.",
          title: "Depuração de programas",
        },
        {
          description:
            "Cobre testes de unidade, testes de integração simples, fixtures e testes de regressão. Você cria uma suíte que protege um programa conforme ele muda.",
          title: "Testes automatizados",
        },
        {
          description:
            "Ensina listas, pilhas, filas, tabelas hash, conjuntos, árvores e grafos como formas de organizar dados. Você escolhe estruturas conforme custo, ordem, busca e atualização.",
          title: "Estruturas de dados",
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
    id: "en-brazilian-history-indigenous-brazil-before-1500",
    userInput: {
      chapterDescription:
        "Covers the peoples, languages, trade networks, farming, fishing, warfare, and environmental knowledge that shaped Brazil before European arrival. Learners use archaeology, oral traditions, and early written sources carefully, without treating 1500 as the beginning of Brazilian history.",
      chapterTitle: "Indigenous Brazil before 1500",
      courseTitle: "Brazilian History",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Traces Portugal’s Atlantic expansion, African trade connections, navigation, Catholic missions, and the first voyages to the South Atlantic coast. The chapter shows how Brazil became part of a wider Atlantic world from the start.",
          title: "Portuguese expansion and the Atlantic world",
        },
        {
          description:
            "Covers early contact, disease, trade in brazilwood, alliances, violence, and the first colonial settlements. Learners compare Portuguese reports with Indigenous perspectives and identify the limits of early colonial control.",
          title: "Contact, brazilwood, and early colonization",
        },
        {
          description:
            "Covers sugar plantations, engenhos, export markets, landholding, credit, and daily work in the Northeast. The chapter connects Brazil’s early wealth to coerced labor and the Atlantic economy.",
          title: "Sugar, plantations, and the colonial economy",
        },
        {
          description:
            "Focuses on Indigenous enslavement, African slavery, the Middle Passage, plantation discipline, resistance, family life, religion, and skilled labor. Learners read runaway slave notices, legal records, and travelers’ accounts as historical evidence.",
          title: "Slavery and African diasporas in colonial Brazil",
        },
      ],
    },
  },
  // Mid-course chapter: focused Kanban method depth from GPT-5.5 course-chapters output
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Kanban-specific false-granularity check: separate lessons for lead time, cycle time, throughput, WIP, item age, and arrival rate are not automatically over-split. They can be valid when each lesson teaches a distinct calculation, interpretation, data-quality concern, or flow-management decision.
      - Penalize as a major issue only when the plan turns the metrics into isolated definitions or near-identical calculations and never asks combined flow-health, bottleneck, demand/capacity, or forecasting questions. If the output is essentially one glossary lesson per metric with a repeated teaching move, the \`majorErrors\` score must be 6.5 or lower.
      - Do not penalize separate lessons for genuinely different tasks, such as choosing which metric answers a question, spotting a bottleneck, preparing reliable data, segmenting work, or using measurements without pressuring people.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-metricas-de-fluxo",
    userInput: {
      chapterDescription:
        "Apresenta as medidas essenciais do Kanban: lead time, cycle time, throughput, WIP, idade do item e taxa de chegada. O aluno calcula métricas a partir de um quadro real ou simulado e evita médias enganosas.",
      chapterTitle: "Métricas de fluxo",
      courseTitle: "Kanban",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Ensina a transformar regras tácitas em políticas visíveis para priorização, movimentação de cartões, desbloqueio, urgência e qualidade. O foco é criar políticas que ajudem decisões diárias sem virar burocracia.",
          title: "Políticas explícitas",
        },
        {
          description:
            "Ensina a ler diagramas de fluxo cumulativo para ver acúmulo, gargalos, variação de demanda e instabilidade. A prática inclui interpretar cenários típicos e decidir quando ajustar WIP, políticas ou capacidade.",
          title: "Diagrama de fluxo cumulativo",
        },
        {
          description:
            "Mostra como a Lei de Little relaciona WIP, throughput e tempo de entrega em sistemas estáveis. O aluno usa a fórmula para testar promessas, perceber excesso de trabalho em andamento e discutir capacidade com dados.",
          title: "Lei de Little e previsibilidade",
        },
        {
          description:
            "Cobre lead time distribution, percentis, aging WIP, throughput histórico e simulações de Monte Carlo para responder “quando termina?” e “quantos cabem até a data?”. A prática inclui montar previsões probabilísticas sem depender de estimativas detalhadas por tarefa.",
          title: "Forecasting probabilístico e Monte Carlo",
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
    id: "pt-direito-processo-civil-procedimento-comum",
    userInput: {
      chapterDescription:
        "Cobre petição inicial, contestação, reconvenção, revelia, saneamento, provas, audiência e sentença. O aluno monta a estrutura de um processo de conhecimento do começo à decisão.",
      chapterTitle: "Processo civil: procedimento comum",
      courseTitle: "Direito",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Cobre competência tributária, impostos, taxas, contribuições, princípios, imunidades e limitações ao poder de tributar. O aluno aprende a identificar quem pode cobrar, o que pode ser cobrado e com quais limites.",
          title: "Direito tributário",
        },
        {
          description:
            "Trata relação de consumo, fornecedor, vulnerabilidade, responsabilidade por produto e serviço, publicidade, cobrança e práticas abusivas. O aluno resolve casos de compras, bancos, planos, plataformas e serviços defeituosos.",
          title: "Direito do consumidor",
        },
        {
          description:
            "Trata jurisdição, ação, competência, partes, capacidade processual, intervenção de terceiros e deveres processuais. O aluno identifica onde propor uma demanda e quem deve participar dela.",
          title: "Processo civil: jurisdição, ação e competência",
        },
        {
          description:
            "Trata inquérito policial, investigação defensiva, ação penal, denúncia, queixa, competência e direitos do investigado. O aluno acompanha o caminho de uma notícia de crime até o início do processo.",
          title: "Processo penal: investigação e ação penal",
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
    id: "pt-biologia-dna-rna-expressao-genica",
    userInput: {
      chapterDescription:
        "Cobre estrutura do DNA, RNA, replicação, transcrição, tradução e código genético. A prática envolve seguir o caminho de uma informação genética até a produção de uma proteína.",
      chapterTitle: "DNA, RNA e expressão gênica",
      courseTitle: "Biologia",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Cobre glicólise, ciclo de Krebs, cadeia transportadora de elétrons, fermentação e balanço energético. Você relaciona esses processos a exercício, leveduras, falta de oxigênio e produção de energia celular.",
          title: "Respiração celular e fermentação",
        },
        {
          description:
            "Trata de interfase, mitose, meiose, cromossomos, gametas e variabilidade genética. Você interpreta cariótipos simples, erros de separação cromossômica e a diferença entre crescimento e reprodução sexuada.",
          title: "Ciclo celular, mitose e meiose",
        },
        {
          description:
            "Cobre mutações, recombinação, epigenética básica, promotores, operons e regulação em eucariotos. O capítulo mostra como diferenças no DNA e no controle dos genes mudam características e funcionamento celular.",
          title: "Mutações, recombinação e regulação gênica",
        },
        {
          description:
            "Cobre níveis de estrutura proteica, dobramento, PDB, modelagem, AlphaFold, desenho de proteínas e limites das previsões. Você compara modelo computacional, evidência experimental e função biológica.",
          title: "Estrutura de proteínas e predição com IA",
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
    id: "es-astronomia-deteccion-de-exoplanetas",
    userInput: {
      chapterDescription:
        "Cubre tránsito, velocidad radial, astrometría, microlentes, imagen directa y sesgos de detección. Practica leer curvas de luz y estimar tamaño, masa y órbita de planetas fuera del Sistema Solar.",
      chapterTitle: "Detección de exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      neighboringChapters: [
        {
          description:
            "Presenta espectros de transmisión, emisión térmica, nubes, composición química, pérdida atmosférica y observaciones con JWST. Conecta señales pequeñas con preguntas sobre climas y mundos reales.",
          title: "Atmósferas de exoplanetas",
        },
        {
          description:
            "Cubre zona habitable, agua líquida, biofirmas, química prebiótica, extremófilos y búsqueda de vida en Marte, lunas heladas y exoplanetas. Mantiene separadas las evidencias fuertes de las hipótesis interesantes.",
          title: "Habitabilidad y astrobiología",
        },
        {
          description:
            "Cubre relatividad general aplicada, interferómetros LIGO/Virgo/KAGRA, fusiones de agujeros negros, estrellas de neutrones y formas de onda. Muestra cómo escuchar el espacio-tiempo añade una ventana distinta a la luz.",
          title: "Astronomía de ondas gravitacionales",
        },
        {
          description:
            "Cubre catálogos masivos, observatorios como Vera C. Rubin, Pan-STARRS y DES, consultas en bases de datos, selección de muestras y sesgos. Prepara para trabajar con millones o miles de millones de objetos de manera ordenada.",
          title: "Grandes sondeos del cielo y astroinformática",
        },
      ],
    },
  },
  // Late chapter: expert-level technical depth
  {
    expectations: `
      - MUST be in US English
      - Transformer-specific boundary check: do not penalize a compact comparison lesson that groups efficient-attention families when it only teaches recognition, cost tradeoffs, or when to choose each family. Penalize it as overloaded only if one lesson tries to teach implementation-level or mechanism-level depth for several variants, or if the plan drops core Transformer architecture coverage to make room.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-machine-learning-transformers",
    userInput: {
      chapterDescription:
        "Covers transformer encoders, decoders, encoder-decoder models, positional encodings, masking, pretraining tasks, and scaling behavior. You connect the architecture to modern NLP, vision, audio, and multimodal systems.",
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Covers queries, keys, values, attention weights, self-attention, cross-attention, positional information, and why attention improves long-range modeling. You implement a small attention block and inspect its behavior.",
          title: "Attention mechanisms",
        },
        {
          description:
            "Covers pretext tasks, contrastive learning, masked prediction, representation learning, and why useful features can come from unlabeled data. You use self-supervised models as strong starting points.",
          title: "Self-supervised learning",
        },
        {
          description:
            "Covers pretrained models, frozen backbones, feature extraction, full fine-tuning, domain shift, and adaptation to small datasets. You reuse existing models responsibly instead of training everything from scratch.",
          title: "Transfer learning",
        },
        {
          description:
            "Covers language model pretraining, token prediction, scaling laws, context windows, instruction tuning, alignment, and common limitations. You treat LLMs as probabilistic systems with strengths, costs, and failure modes.",
          title: "Large language models",
        },
      ],
    },
  },
];
