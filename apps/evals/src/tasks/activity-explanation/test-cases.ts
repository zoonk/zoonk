const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: Any scientific processes, mechanisms, or technical details must be correct. Penalize hallucinations, made-up components, or incorrect cause-effect relationships.

2. DEPTH: Complex topics require multi-layered explanations. Penalize superficial overviews that skip essential mechanisms.

3. CLARITY: Steps should build understanding progressively, explaining concepts in accessible language.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like explaining to a curious friend. Include analogies from everyday life.

6. FOCUS: Explains WHAT something IS, not history or origin stories.

7. NO OVERLAP: Must not repeat content from the BACKGROUND_STEPS.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing components, phases, or concepts you might expect
- Do NOT require a specific number of steps
- Do NOT check against an imagined "complete" explanation
- Do NOT penalize for output format or structure (e.g., JSON wrapping, key names, array nesting). We use structured outputs, so focus exclusively on content quality
- Do NOT penalize for the ordering of explanation steps. Different valid structures and sequences exist
- ONLY penalize for: factual errors, superficial treatment of complex topics, not using the conversational tone (everyday language) we asked or poor explanation structure
- Different valid explanatory approaches exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Network data movement involves specific concepts like encapsulation, protocol layers, and hop-by-hop forwarding. Penalize if:
   - Encapsulation is confused with encryption (encapsulation wraps data with headers at each layer)

2. DEPTH CHECK: Penalize if the explanation treats data movement as simply "data goes from A to B" without showing how encapsulation and forwarding constraints work together.

3. DISTINCTION FROM BACKGROUND: The background covered WHY data needs layered packaging. This should explain WHAT encapsulation, protocol layers, and hop-by-hop forwarding actually are.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-data-movement",
    userInput: {
      backgroundSteps: [
        {
          text: "Early computer networks were a tangle of incompatible systems. Sending a message across networks was like mailing a letter through countries with different postal rules.",
          title: "The Compatibility Problem",
        },
        {
          text: "Engineers realized data needed to be wrapped in layers, each handling one part of the journey. This layered approach let the internet scale to billions of devices.",
          title: "Layers of Wrapping",
        },
      ],
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Core building blocks for how data moves across networks, from encapsulation to hop-by-hop forwarding constraints.",
      lessonTitle: "How Data Moves on Networks",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python numeric types involve specific relationships between float, bool, and int. Penalize if:
   - bool is described as unrelated to int (bool is a subclass of int in Python)

2. DEPTH CHECK: Penalize if the explanation treats floats and bools as simple "number types" without showing the structural relationship between bool and int, or the significance of floating-point representation.

3. DISTINCTION FROM BACKGROUND: The background covered WHY different numeric types exist. This should explain WHAT floats and bools are, their literal syntax, and how bool relates structurally to int.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
    userInput: {
      backgroundSteps: [
        {
          text: "Computadores precisam representar diferentes tipos de números. Inteiros são simples, mas e quando precisamos de frações? Ou de verdadeiro/falso? Cada necessidade gerou um tipo numérico distinto.",
          title: "Além dos Inteiros",
        },
        {
          text: "Python unificou esses tipos em uma hierarquia elegante. Entender essa relação revela por que operações aparentemente estranhas, como somar True + True, funcionam perfeitamente.",
          title: "Uma Família de Tipos",
        },
      ],
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Valores de ponto flutuante e booleanos, sintaxe de literais e a relação estrutural entre bool e int.",
      lessonTitle: "Float e bool como tipos numéricos",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Labor market aggregates involve specific empirical patterns during business cycles. Penalize if:
   - Unemployment is described as moving inversely with output without acknowledging lags (unemployment typically lags GDP changes)

2. DEPTH CHECK: Penalize if the explanation treats labor markets during downturns as simply "people lose jobs" without showing the empirical regularities in employment, hours, and participation rates.

3. DISTINCTION FROM BACKGROUND: The background covered WHY labor markets fluctuate with the business cycle. This should explain WHAT the specific empirical patterns are — how unemployment, hours worked, and labor force participation move during downturns.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-cycles",
    userInput: {
      backgroundSteps: [
        {
          text: "Economies don't grow steadily — they surge and contract in waves. During each downturn, the pain isn't spread evenly. Labor markets absorb much of the shock.",
          title: "The Boom-Bust Pattern",
        },
        {
          text: "Economists noticed that certain labor market indicators move in predictable patterns during recessions. These regularities became essential for understanding how downturns affect real people.",
          title: "Patterns in the Pain",
        },
      ],
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "Empirical regularities linking downturns to labor market outcomes at the level of aggregate fluctuations, without modeling search or wage-setting mechanisms.",
      lessonTitle: "Labor market aggregates over the cycle",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: α-acidity and enolate chemistry involve specific chemical concepts. Penalize if:
   - Enolates are described as electrophiles (they are nucleophiles)
   - α-hydrogen acidity is attributed to inductive effects alone (resonance stabilization of the enolate is the primary factor)

2. DEPTH CHECK: Penalize if the explanation treats enolate formation as simply "removing a hydrogen" without showing why the α-position is specifically acidic and how the resulting enolate acts as a nucleophile.

3. DISTINCTION FROM BACKGROUND: The background covered WHY carbon-carbon bond formation matters in organic chemistry. This should explain WHAT α-acidity is and how enolates form as key nucleophiles.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-acidez-enolatos",
    userInput: {
      backgroundSteps: [
        {
          text: "Construir moléculas complejas requiere formar enlaces carbono-carbono. Pero el carbono no es naturalmente reactivo — los químicos necesitaron encontrar posiciones especialmente activadas.",
          title: "El Desafío del Enlace C–C",
        },
        {
          text: "Junto a un grupo carbonilo, ciertos hidrógenos se vuelven sorprendentemente ácidos. Esta acidez inesperada abrió la puerta a toda una familia de reacciones de construcción molecular.",
          title: "Un Hidrógeno Especial",
        },
      ],
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "Origen de la acidez en α y cómo se forma el enolato como nucleófilo clave en reacciones de construcción C–C.",
      lessonTitle: "Acidez en α y formación de enolatos",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Automation measurement in legal tech involves specific operational metrics. Penalize if:
   - Metrics are described without connection to quality or safety concerns (the focus should be on quality assurance and audit trails)

2. DEPTH CHECK: Penalize if the explanation treats automation monitoring as simply "checking if it works" without showing what specific metrics matter for document quality and safety.

3. DISTINCTION FROM BACKGROUND: The background covered WHY monitoring legal document automation matters. This should explain WHAT operational metrics, quality indicators, and audit trails look like in practice.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-automacao",
    userInput: {
      backgroundSteps: [
        {
          text: "Escritórios de advocacia adotaram automação documental para ganhar eficiência. Mas automatizar sem monitorar é como dirigir de olhos fechados — rápido, mas perigoso.",
          title: "Velocidade sem Controle",
        },
        {
          text: "Erros em documentos jurídicos podem custar processos inteiros. A profissão percebeu que precisava de métricas para garantir que a automação mantivesse a qualidade que clientes esperam.",
          title: "O Custo do Erro Silencioso",
        },
      ],
      chapterTitle: "Legal tech e automação de documentos",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Métricas operacionais focadas em qualidade e segurança da automação documental, com rastros para auditoria.",
      lessonTitle: "Medição e monitoramento da automação",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Connectivity debugging involves systematic layer-by-layer reasoning. Penalize if:
   - Debugging is described as starting from the application layer down (systematic models typically start from physical/link layer up)
   - Mental models are confused with specific tool outputs (the focus is on reasoning frameworks, not tool usage)

2. DEPTH CHECK: Penalize if the explanation treats debugging as simply "check if it works" without showing how to systematically narrow a connectivity problem to a specific layer — host, subnet, gateway, path, or service.

3. DISTINCTION FROM BACKGROUND: The background covered WHY systematic debugging approaches matter. This should explain WHAT the mental models are — how to reason about reachability at each layer to isolate where connectivity breaks.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-debugging-mental-models",
    userInput: {
      backgroundSteps: [
        {
          text: "When a web app can't reach a server, the problem could be anywhere — your machine, the local network, a router along the path, or the server itself. Without a system, debugging is guesswork.",
          title: "The Needle in the Stack",
        },
        {
          text: "Experienced engineers don't try random fixes. They use mental models to systematically narrow the problem layer by layer, turning a haystack into a checklist.",
          title: "Thinking in Layers",
        },
      ],
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
    },
  },
];
