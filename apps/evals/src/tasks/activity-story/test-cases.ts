const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STORY AUTHENTICITY: Dialogue must be pure conversation between colleagues with no narrator text, no character name prefixes (like "Sarah:"), and no action descriptions. The learner should feel immersed in a real workplace conversation.

2. EDUCATIONAL ALIGNMENT: Every decision point must require applying lesson concepts through reasoning, not memorizing facts. Wrong options should be plausible but flawed for specific conceptual reasons.

3. PLOT COHERENCE: Steps must flow naturally as a continuous story where each step builds from the previous dialogue. Near the end (within the final 2-3 steps), the story should introduce a fun, surprising twist that reframes the narrative — the best twists subvert an assumption the story has been building. The final step must resolve the problem AND reinforce the main learning takeaway. Do NOT penalize for exact twist placement (e.g., 2nd-to-last vs 3rd-to-last) as long as the narrative flow is good.

4. FORMAT COMPLIANCE: Verify these constraints:
   - context: Maximum 500 characters of pure dialogue
   - question: Maximum 100 characters
   - options: Exactly 4 objects, each with: text (max 50 chars, allow up to 55 without penalty), isCorrect (boolean), feedback (max 300 chars)
   - Exactly 1 option must have isCorrect: true, the other 3 must have isCorrect: false
   - Do NOT penalize for output being wrapped in {"steps": [...]} vs a raw array — both are valid formats

5. PERSONALIZATION: The {{NAME}} placeholder must be used appropriately in dialogue to personalize the experience.

6. FEEDBACK QUALITY: Each option must have feedback explaining WHY it's right (with insight) or WHY it's wrong (and what would be correct). Feedback should help learners understand the reasoning, not just state correctness.

7. STEP COUNT: Story must have between 7 and 20 steps. Let problem complexity dictate length.

8. DISTRACTOR QUALITY: All wrong options must be plausible choices someone might consider. Penalize obviously silly or absurd options that no reasonable person would choose.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific plot choices, character names, or scenario settings you might expect
- Do NOT require specific steps like "investigation" or "resolution" by name - focus on whether the story has good flow
- Do NOT check against an imagined "ideal" story structure
- Do NOT penalize for exact twist placement — if the twist occurs anywhere in the final third of the story, that's fine
- Do NOT penalize for output being wrapped in {"steps": [...]} instead of a raw array
- Do NOT penalize option text that is 55 characters or fewer — only penalize options clearly exceeding 55 characters
- ONLY penalize for: format violations (option text over 55 chars, context over 500 chars, etc.), narrator/description text in dialogue, decisions that test memorization instead of reasoning, complete absence of any twist or surprise, poor distractor quality, or factually incorrect lesson application
- Different valid story approaches exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: TypeScript typing decisions must reflect genuine type system reasoning. Penalize if:
   - Type narrowing concepts are incorrectly applied
   - Union types, generics, or utility types are misrepresented
   - Decisions don't require understanding when strict typing helps vs. hurts

2. SCENARIO CHECK: The workplace problem should involve realistic TypeScript challenges like: refactoring JavaScript to TypeScript, debugging type errors, designing type-safe APIs, or handling third-party library types.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about type safety trade-offs, not just recall of syntax.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-typescript-type-safety",
    userInput: {
      chapterTitle: "Type Systems",
      courseTitle: "Advanced TypeScript",
      explanationSteps: [
        {
          text: "Type safety catches errors at compile time instead of runtime. When TypeScript knows a variable's type, it can prevent operations that would fail — like calling .length on undefined.",
          title: "Compile-Time Safety",
        },
        {
          text: "TypeScript uses structural typing — it cares about shape, not names. Two types are compatible if they have the same structure, even if defined separately.",
          title: "Structural Typing",
        },
        {
          text: "Type narrowing lets TypeScript understand more specific types after checks. Inside an if-block that checks for null, TypeScript knows the value isn't null.",
          title: "Type Narrowing",
        },
        {
          text: "Generic types let you write reusable code that works with multiple types while preserving type information. Array<T> knows what's inside, unlike just 'Array'.",
          title: "Generics",
        },
        {
          text: "The 'any' type disables type checking entirely. It's an escape hatch but defeats the purpose of TypeScript. Use 'unknown' when the type truly isn't known.",
          title: "Any vs Unknown",
        },
        {
          text: "Type guards are functions that narrow types. They return a type predicate that tells TypeScript what the type is after the check passes.",
          title: "Type Guards",
        },
      ],
      language: "en",
      lessonDescription:
        "Applying TypeScript's type system to catch bugs early and write more maintainable code",
      lessonTitle: "Type Safety in Practice",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Game theory decisions must reflect genuine strategic reasoning. Penalize if:
   - Nash equilibrium is incorrectly applied or described
   - Dominant strategies are confused with dominated strategies
   - Payoff matrices or strategic interactions are misrepresented

2. SCENARIO CHECK: The workplace problem should involve realistic strategic decisions like: pricing strategy, negotiation tactics, competitive positioning, or resource allocation under competition.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about interdependent choices and anticipating others' responses, not just recalling definitions.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-game-theory-strategy",
    userInput: {
      chapterTitle: "Strategic Decision Making",
      courseTitle: "Microeconomics",
      explanationSteps: [
        {
          text: "Game theory studies strategic interactions where your outcome depends on others' choices too. It's not about games — it's about any situation where what you should do depends on what others do.",
          title: "Strategic Interdependence",
        },
        {
          text: "A Nash equilibrium is a stable state where no player can improve by changing only their own strategy. Everyone is doing their best given what everyone else is doing.",
          title: "Nash Equilibrium",
        },
        {
          text: "A dominant strategy is best regardless of what others do. If you have one, use it. But most real situations don't have dominant strategies — you must anticipate others.",
          title: "Dominant Strategies",
        },
        {
          text: "The prisoner's dilemma shows how individual rationality can lead to collective irrationality. Both players choosing their dominant strategy leaves both worse off.",
          title: "The Prisoner's Dilemma",
        },
        {
          text: "Repeated games change the calculus. When you'll interact again, cooperation becomes rational because future punishment makes defection costly.",
          title: "Repeated Interactions",
        },
      ],
      language: "en",
      lessonDescription:
        "Using game theory to analyze competitive situations and make better strategic decisions",
      lessonTitle: "Strategic Thinking with Game Theory",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: CRISPR gene editing concepts must be scientifically accurate. Penalize if:
   - CRISPR is described as directly rewriting DNA (it cuts; cellular repair does the editing)
   - Off-target effects or guide RNA specificity are misrepresented
   - Ethical considerations are oversimplified or strawmanned

2. SCENARIO CHECK: The workplace problem should involve realistic biotech challenges like: designing experiments, troubleshooting editing efficiency, addressing off-target concerns, or navigating ethical review.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about the mechanism's limitations and appropriate applications, not just knowing what CRISPR stands for.

${SHARED_EXPECTATIONS}
    `,
    id: "en-biology-crispr-applications",
    userInput: {
      chapterTitle: "Genetic Engineering",
      courseTitle: "Modern Biotechnology",
      explanationSteps: [
        {
          text: "CRISPR-Cas9 is a molecular scissors that cuts DNA at specific locations. The Cas9 protein does the cutting; a guide RNA tells it exactly where to cut.",
          title: "The Molecular Scissors",
        },
        {
          text: "Guide RNA is a short sequence that matches the target DNA. It base-pairs with the DNA sequence you want to edit, bringing Cas9 to the exact spot.",
          title: "Guide RNA Targeting",
        },
        {
          text: "After CRISPR cuts, the cell's repair machinery fixes the break. Non-homologous end joining often introduces errors (knockouts). Homology-directed repair can insert new sequences (knock-ins).",
          title: "Cellular Repair Pathways",
        },
        {
          text: "Off-target effects occur when CRISPR cuts unintended locations. Guide RNA design and delivery methods affect specificity. This is a major safety concern for therapeutic applications.",
          title: "Off-Target Effects",
        },
        {
          text: "Delivery is a key challenge. Getting CRISPR components into the right cells in a living organism is harder than in a lab dish. Viral vectors and lipid nanoparticles are common approaches.",
          title: "Delivery Challenges",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how to apply CRISPR gene editing technology effectively and responsibly",
      lessonTitle: "CRISPR Gene Editing in Practice",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Cognitive load concepts must reflect genuine psychology. Penalize if:
   - Intrinsic, extraneous, and germane load are confused or misapplied
   - Working memory limitations are incorrectly represented
   - Chunking or scaffolding principles are misused

2. SCENARIO CHECK: The workplace problem should involve realistic instructional design challenges like: simplifying complex training, redesigning confusing interfaces, or optimizing learning materials.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about how to reduce unnecessary load while preserving essential complexity.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-psychology-cognitive-load",
    userInput: {
      chapterTitle: "Psicologia da Aprendizagem",
      courseTitle: "Design Instrucional",
      explanationSteps: [
        {
          text: "A memoria de trabalho tem capacidade limitada — cerca de 4 itens simultaneamente. Quando sobrecarregada, a aprendizagem para. O cerebro nao consegue processar mais.",
          title: "Limites da Memoria",
        },
        {
          text: "Carga intrinseca vem da complexidade inerente do conteudo. Algumas coisas sao simplesmente dificeis. Nao da para eliminar, mas da para gerenciar.",
          title: "Carga Intrinseca",
        },
        {
          text: "Carga extrinseca vem do design ruim — instrucoes confusas, distracao visual, navegacao complicada. Essa carga pode e deve ser eliminada.",
          title: "Carga Extrinseca",
        },
        {
          text: "Carga germanica e o esforco produtivo de aprender — criar conexoes, elaborar, integrar. Queremos maximizar essa carga enquanto minimizamos a extrinseca.",
          title: "Carga Germanica",
        },
        {
          text: "Chunking agrupa informacoes em unidades significativas. Um numero de telefone e mais facil de lembrar como blocos (99-8765-4321) do que como 10 digitos soltos.",
          title: "Chunking",
        },
      ],
      language: "pt",
      lessonDescription:
        "Aplicando a teoria da carga cognitiva para criar materiais de aprendizagem mais eficazes",
      lessonTitle: "Carga Cognitiva na Pratica",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Thermodynamics concepts must be physically accurate. Penalize if:
   - Entropy is described only as "disorder" without the energy dispersal aspect
   - The second law is misrepresented or applied to closed vs. open systems incorrectly
   - Heat and temperature are confused

2. SCENARIO CHECK: The workplace problem should involve realistic engineering challenges like: heat engine efficiency, thermal management, refrigeration design, or energy system optimization.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about energy flow, efficiency limits, and thermodynamic constraints.

${SHARED_EXPECTATIONS}
    `,
    id: "es-physics-thermodynamics-applications",
    userInput: {
      chapterTitle: "Termodinamica",
      courseTitle: "Fisica para Ingenieros",
      explanationSteps: [
        {
          text: "La primera ley dice que la energia se conserva — no se crea ni destruye, solo se transforma. El calor que entra menos el trabajo que sale iguala el cambio de energia interna.",
          title: "Conservacion de Energia",
        },
        {
          text: "La segunda ley establece una direccion: el calor fluye espontaneamente de caliente a frio, nunca al reves. Esto limita la eficiencia de cualquier motor termico.",
          title: "Direccion del Calor",
        },
        {
          text: "La entropia mide la dispersion de energia. Cuando la energia se dispersa (calor fluyendo a lo frio), la entropia aumenta. Concentrar energia requiere trabajo externo.",
          title: "Entropia",
        },
        {
          text: "El ciclo de Carnot define la eficiencia maxima teorica. Ningun motor real puede ser mas eficiente. La eficiencia depende de las temperaturas de las fuentes caliente y fria.",
          title: "Limite de Carnot",
        },
        {
          text: "Los refrigeradores y bombas de calor mueven calor de frio a caliente usando trabajo. No violan la segunda ley — el trabajo compensa el flujo 'antinatural' de calor.",
          title: "Refrigeracion",
        },
      ],
      language: "es",
      lessonDescription:
        "Aplicando las leyes de la termodinamica para entender y disenar sistemas energeticos",
      lessonTitle: "Termodinamica Aplicada",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Distributed systems concepts must be technically accurate. Penalize if:
   - CAP theorem trade-offs are misrepresented
   - Eventual consistency is confused with strong consistency
   - Network partition handling is incorrectly described

2. SCENARIO CHECK: The workplace problem should involve realistic distributed systems challenges like: choosing consistency models, handling failover, debugging race conditions, or scaling databases.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about distributed system trade-offs under failure conditions.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-distributed-systems-consistency",
    userInput: {
      chapterTitle: "Distributed Data",
      courseTitle: "System Design",
      explanationSteps: [
        {
          text: "The CAP theorem states you can only have two of three: Consistency, Availability, and Partition tolerance. Since network partitions happen, you're really choosing between C and A.",
          title: "CAP Theorem",
        },
        {
          text: "Strong consistency means all nodes see the same data at the same time. Every read returns the most recent write. This requires coordination that can slow things down.",
          title: "Strong Consistency",
        },
        {
          text: "Eventual consistency means replicas will converge given enough time without new writes. Reads might return stale data temporarily, but the system stays available.",
          title: "Eventual Consistency",
        },
        {
          text: "Network partitions occur when nodes can't communicate. The system must decide: reject requests (maintain consistency) or accept requests that might conflict (maintain availability).",
          title: "Partition Handling",
        },
        {
          text: "Quorum-based systems use voting. A write succeeds if enough replicas acknowledge it. Read quorum + write quorum > total nodes ensures reading at least one up-to-date copy.",
          title: "Quorum Systems",
        },
        {
          text: "Conflict resolution strategies handle divergent writes: last-write-wins, vector clocks, or application-specific merge logic. The right choice depends on your data semantics.",
          title: "Conflict Resolution",
        },
      ],
      language: "en",
      lessonDescription:
        "Navigating consistency and availability trade-offs in distributed systems",
      lessonTitle: "Consistency in Distributed Systems",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Behavioral economics concepts must reflect genuine research. Penalize if:
   - Loss aversion magnitude is misrepresented (losses hurt roughly 2x gains)
   - Framing effects are confused with actual preference changes
   - Nudge principles are applied without understanding choice architecture

2. SCENARIO CHECK: The workplace problem should involve realistic behavioral design challenges like: improving user engagement, designing incentive structures, reducing churn, or encouraging healthy behaviors.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about psychological biases and how to design for real human behavior.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-behavioral-design",
    userInput: {
      chapterTitle: "Applied Behavioral Economics",
      courseTitle: "Product Psychology",
      explanationSteps: [
        {
          text: "Loss aversion means losses hurt more than equivalent gains feel good — roughly twice as much. People will take irrational risks to avoid losses they wouldn't take to achieve gains.",
          title: "Loss Aversion",
        },
        {
          text: "Framing effects show that how you present options matters as much as what the options are. '90% survival rate' and '10% mortality rate' are logically identical but feel different.",
          title: "Framing Effects",
        },
        {
          text: "Default effects are powerful because people tend to stick with pre-selected options. Changing the default can dramatically change outcomes without restricting choice.",
          title: "Default Effects",
        },
        {
          text: "Present bias makes us overvalue immediate rewards over future ones. We know we should save for retirement, but the money feels more valuable now. Commitment devices help.",
          title: "Present Bias",
        },
        {
          text: "Social proof drives behavior — we look to others to decide what's appropriate. Showing that 'most people do X' is often more effective than explaining why X is good.",
          title: "Social Proof",
        },
      ],
      language: "en",
      lessonDescription:
        "Applying behavioral economics principles to design products and systems that work with human psychology",
      lessonTitle: "Behavioral Design in Practice",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Organic chemistry reaction concepts must be chemically accurate. Penalize if:
   - Nucleophiles and electrophiles are confused
   - SN1 vs SN2 mechanism conditions are misrepresented
   - Stereochemistry outcomes are incorrect

2. SCENARIO CHECK: The workplace problem should involve realistic organic chemistry challenges like: synthesis planning, troubleshooting reactions, optimizing yields, or predicting products.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about electron flow, mechanism steps, and reaction conditions.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-chemistry-organic-reactions",
    userInput: {
      chapterTitle: "Reacoes Organicas",
      courseTitle: "Quimica Organica II",
      explanationSteps: [
        {
          text: "Nucleofilos sao especies ricas em eletrons que doam pares de eletrons. Eletrofilos sao especies pobres em eletrons que aceitam. Reacoes organicas sao geralmente nucleofilos atacando eletrofilos.",
          title: "Nucleofilos e Eletrofilos",
        },
        {
          text: "SN2 e um mecanismo concertado — o nucleofilo ataca enquanto o grupo de saida sai, em um unico passo. Funciona melhor com substratos primarios e nucleofilos fortes.",
          title: "Mecanismo SN2",
        },
        {
          text: "SN1 ocorre em dois passos: primeiro o grupo de saida sai formando um carbocation, depois o nucleofilo ataca. Favorecido por substratos terciarios e solventes polares proticos.",
          title: "Mecanismo SN1",
        },
        {
          text: "A estereoquimica revela o mecanismo. SN2 inverte a configuracao (ataque por tras). SN1 pode dar mistura racemicacon (carbocation planar atacado de ambos os lados).",
          title: "Estereoquimica",
        },
        {
          text: "Grupos de saida precisam ser estaveis apos sair. Bons grupos de saida sao bases fracas — haletos, tosilatos, agua protonada. Grupos de saida ruins sao bases fortes.",
          title: "Grupos de Saida",
        },
      ],
      language: "pt",
      lessonDescription:
        "Aplicando mecanismos de reacao organica para prever e otimizar sinteses quimicas",
      lessonTitle: "Mecanismos de Substituicao",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Neural network architecture concepts must be technically accurate. Penalize if:
   - Convolution operations are incorrectly described
   - Pooling and stride effects are confused
   - Transfer learning principles are misrepresented

2. SCENARIO CHECK: The workplace problem should involve realistic deep learning challenges like: choosing architectures, debugging training issues, handling overfitting, or deploying models.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about architecture choices and their trade-offs.

${SHARED_EXPECTATIONS}
    `,
    id: "es-cs-neural-network-architecture",
    userInput: {
      chapterTitle: "Arquitecturas de Redes Neuronales",
      courseTitle: "Deep Learning Aplicado",
      explanationSteps: [
        {
          text: "Las capas convolucionales detectan patrones locales usando filtros que se deslizan sobre la entrada. El mismo filtro se aplica en todas partes, lo que reduce parametros y captura patrones sin importar su posicion.",
          title: "Capas Convolucionales",
        },
        {
          text: "El pooling reduce la dimension espacial tomando el maximo o promedio de regiones. Esto hace la representacion mas compacta y algo invariante a pequenas traslaciones.",
          title: "Pooling",
        },
        {
          text: "Las funciones de activacion introducen no-linealidad. ReLU (max(0,x)) es popular por ser simple y evitar el problema del gradiente desvaneciente en capas profundas.",
          title: "Activaciones",
        },
        {
          text: "El dropout desactiva neuronas aleatoriamente durante el entrenamiento. Esto fuerza redundancia y reduce el sobreajuste — la red no puede depender de ninguna neurona especifica.",
          title: "Dropout",
        },
        {
          text: "El transfer learning usa redes pre-entrenadas en grandes datasets. Las capas tempranas aprenden patrones generales; las tardias se ajustan a tu tarea especifica.",
          title: "Transfer Learning",
        },
        {
          text: "El batch normalization normaliza activaciones entre capas. Estabiliza el entrenamiento, permite tasas de aprendizaje mas altas, y actua como regularizador.",
          title: "Batch Normalization",
        },
      ],
      language: "es",
      lessonDescription:
        "Disenando y optimizando arquitecturas de redes neuronales para problemas reales",
      lessonTitle: "Arquitecturas de Deep Learning",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Statistical hypothesis testing concepts must be mathematically sound. Penalize if:
   - p-values are misinterpreted (not the probability the null is true)
   - Type I and Type II errors are confused
   - Statistical vs. practical significance are conflated

2. SCENARIO CHECK: The workplace problem should involve realistic data analysis challenges like: A/B test interpretation, experiment design, multiple comparison issues, or communicating results to stakeholders.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about statistical inference principles, not just plugging numbers into formulas.

${SHARED_EXPECTATIONS}
    `,
    id: "en-statistics-hypothesis-testing",
    userInput: {
      chapterTitle: "Statistical Inference",
      courseTitle: "Applied Statistics",
      explanationSteps: [
        {
          text: "The null hypothesis (H0) is the default assumption of no effect. We try to reject it. The p-value measures how surprising the data would be IF the null were true.",
          title: "Null Hypothesis",
        },
        {
          text: "A p-value is NOT the probability the null is true. It's the probability of seeing data this extreme (or more) if the null IS true. A common and dangerous misinterpretation.",
          title: "P-Value Meaning",
        },
        {
          text: "Type I error (false positive) is rejecting a true null. Type II error (false negative) is failing to reject a false null. You can't minimize both — there's a trade-off.",
          title: "Error Types",
        },
        {
          text: "Statistical power is the probability of detecting a real effect. It depends on sample size, effect size, and significance level. Low-powered studies miss real effects.",
          title: "Statistical Power",
        },
        {
          text: "Statistical significance doesn't mean practical significance. A huge sample can detect tiny effects that don't matter in practice. Always consider effect size.",
          title: "Practical Significance",
        },
        {
          text: "Multiple comparisons inflate Type I errors. Testing 20 hypotheses at alpha=0.05 expects one false positive. Corrections like Bonferroni or FDR control this.",
          title: "Multiple Comparisons",
        },
      ],
      language: "en",
      lessonDescription:
        "Applying statistical hypothesis testing correctly to make sound data-driven decisions",
      lessonTitle: "Hypothesis Testing in Practice",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Quantum computing concepts must be physically accurate. Penalize if:
   - Superposition is described as "being in two places at once" (it's about probability amplitudes)
   - Quantum parallelism benefits are overstated or misrepresented
   - Decoherence and error correction challenges are minimized

2. SCENARIO CHECK: The workplace problem should involve realistic quantum computing challenges like: algorithm selection, hardware limitations, error mitigation, or identifying suitable problems for quantum advantage.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about when quantum approaches help and their fundamental limitations.

${SHARED_EXPECTATIONS}
    `,
    id: "en-physics-quantum-computing-basics",
    userInput: {
      chapterTitle: "Quantum Information",
      courseTitle: "Quantum Computing Fundamentals",
      explanationSteps: [
        {
          text: "Qubits can exist in superposition — a weighted combination of 0 and 1 states. This isn't 'both at once' — it's a probability amplitude that interferes before measurement.",
          title: "Superposition",
        },
        {
          text: "Entanglement links qubits so measuring one instantly determines the other, regardless of distance. This correlation is a resource for quantum algorithms.",
          title: "Entanglement",
        },
        {
          text: "Quantum parallelism lets algorithms evaluate functions on all inputs simultaneously. But you can only read one result — the art is using interference to amplify the right answer.",
          title: "Quantum Parallelism",
        },
        {
          text: "Decoherence destroys quantum information when qubits interact with their environment. Real qubits are noisy and maintain coherence only briefly.",
          title: "Decoherence",
        },
        {
          text: "Quantum error correction encodes logical qubits in many physical qubits. The overhead is huge — thousands of physical qubits per logical qubit for fault tolerance.",
          title: "Error Correction",
        },
        {
          text: "Quantum advantage requires the right problem type. Factoring, simulation, and certain optimization problems benefit. Most classical algorithms won't be replaced.",
          title: "Where Quantum Helps",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding quantum computing capabilities and limitations for practical problem-solving",
      lessonTitle: "Quantum Computing Fundamentals",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Microservices architecture concepts must be technically sound. Penalize if:
   - Service boundaries are drawn incorrectly (by technical layer vs. business domain)
   - Distributed system challenges are understated
   - Eventual consistency implications are misrepresented

2. SCENARIO CHECK: The workplace problem should involve realistic architecture decisions like: service decomposition, data consistency, API versioning, or handling distributed failures.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about the trade-offs between monolith and microservices architectures.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-cs-microservices-architecture",
    userInput: {
      chapterTitle: "Arquitetura de Software",
      courseTitle: "Engenharia de Software Avancada",
      explanationSteps: [
        {
          text: "Microservicos sao servicos pequenos e independentes que fazem uma coisa bem. Cada um pode ser desenvolvido, implantado e escalado separadamente.",
          title: "Definicao de Microservicos",
        },
        {
          text: "Limites de servico devem seguir dominios de negocio, nao camadas tecnicas. Um servico de 'Pedidos' faz sentido; um servico de 'Banco de Dados' nao.",
          title: "Limites de Servico",
        },
        {
          text: "A comunicacao entre servicos pode ser sincrona (REST, gRPC) ou assincrona (filas, eventos). Assincrona e mais resiliente mas mais complexa de debugar.",
          title: "Comunicacao",
        },
        {
          text: "Dados descentralizados significam que cada servico tem seu banco. Consistencia eventual e a realidade — transacoes distribuidas sao dificeis e devem ser evitadas.",
          title: "Dados Descentralizados",
        },
        {
          text: "Falhas em cascata acontecem quando um servico lento trava outros. Circuit breakers, timeouts e fallbacks sao essenciais para resiliencia.",
          title: "Resiliencia",
        },
        {
          text: "Observabilidade requer logs centralizados, metricas e tracing distribuido. Sem isso, debugar problemas em producao e quase impossivel.",
          title: "Observabilidade",
        },
      ],
      language: "pt",
      lessonDescription:
        "Projetando e implementando arquiteturas de microservicos com consciencia dos trade-offs",
      lessonTitle: "Microservicos na Pratica",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Calculus optimization concepts must be mathematically correct. Penalize if:
   - Critical points are confused with extrema
   - Second derivative test is misapplied
   - Constraint optimization (Lagrange multipliers) is incorrectly described

2. SCENARIO CHECK: The workplace problem should involve realistic optimization challenges like: minimizing costs, maximizing efficiency, resource allocation, or engineering design constraints.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about when and how to apply optimization techniques.

${SHARED_EXPECTATIONS}
    `,
    id: "es-math-calculus-optimization",
    userInput: {
      chapterTitle: "Aplicaciones del Calculo",
      courseTitle: "Calculo para Ingenieria",
      explanationSteps: [
        {
          text: "Los puntos criticos son donde la derivada es cero o no existe. Son CANDIDATOS a extremos — no todos los puntos criticos son maximos o minimos.",
          title: "Puntos Criticos",
        },
        {
          text: "La prueba de la segunda derivada determina el tipo: si f''(x) > 0 en un punto critico, es minimo local; si f''(x) < 0, es maximo local; si f''(x) = 0, la prueba no concluye.",
          title: "Prueba de Segunda Derivada",
        },
        {
          text: "Los extremos globales pueden estar en puntos criticos O en los extremos del dominio. Siempre evalua tambien los bordes del intervalo.",
          title: "Extremos Globales",
        },
        {
          text: "Optimizacion con restricciones usa multiplicadores de Lagrange. Maximizar f(x,y) sujeto a g(x,y)=0 requiere que los gradientes sean paralelos.",
          title: "Multiplicadores de Lagrange",
        },
        {
          text: "Modelar el problema correctamente es la mitad del trabajo. Define la funcion objetivo, identifica las restricciones, y expresa todo en terminos de las variables relevantes.",
          title: "Modelado del Problema",
        },
      ],
      language: "es",
      lessonDescription:
        "Aplicando tecnicas de calculo para encontrar optimos en problemas de ingenieria y negocios",
      lessonTitle: "Optimizacion con Calculo",
    },
  },
];
