const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: Any process descriptions, mechanisms, or cause-effect relationships must be correct. Penalize hallucinations, incorrect sequences, or wrong causal chains.

2. PROCESS FOCUS: Content must show things HAPPENING, not just describe parts. Look for action verbs, cause-effect language, and sequential flow.

3. DEPTH: Complex processes require multi-step explanations showing how one action triggers the next. Penalize oversimplified "just happens" explanations.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like giving a behind-the-scenes tour. Include process metaphors from everyday life (assembly lines, relay races, domino chains).

6. FOCUS: Explains HOW something works (processes in action), not WHAT it is (definitions) or WHY it exists (history).

7. NO OVERLAP: Must not repeat content from the EXPLANATION_STEPS which covered the WHAT.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing process phases or steps you might expect
- Do NOT require a specific number of steps
- Do NOT check against an imagined "complete" process description
- ONLY penalize for: factual errors, static descriptions instead of action-oriented content, missing cause-effect relationships, or poor process flow
- Different valid process explanations exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: The immune response involves specific cell types acting in sequence. Penalize if:
   - T cells are described as producing antibodies (B cells produce antibodies; T cells have different roles)
   - The process skips the critical recognition phase where pathogens are identified

2. DEPTH CHECK: Penalize if the response treats immunity as "cells attack germs" without showing the cascade of signals, recognition, and coordinated response.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT immune cells and antibodies ARE. This should show HOW they detect, signal, coordinate, and eliminate threats in real-time.

${SHARED_EXPECTATIONS}
    `,
    id: "en-biology-immune-response",
    userInput: {
      chapterTitle: "Body Systems",
      courseTitle: "Human Biology",
      explanationSteps: [
        {
          text: "White blood cells are specialized defenders in your bloodstream. Different types handle different tasks — some patrol, some remember, some attack directly.",
          title: "The Cellular Army",
        },
        {
          text: "Antibodies are Y-shaped proteins that act like molecular handcuffs. Each type fits one specific pathogen shape, marking it for destruction.",
          title: "Antibody Recognition",
        },
        {
          text: "Memory cells are veterans that remember past invaders. They remain dormant for years, ready to rapidly respond if the same threat returns.",
          title: "Immune Memory",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding the step-by-step process of how the immune system detects, responds to, and eliminates pathogens",
      lessonTitle: "The Immune Response Process",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: DNA transcription involves specific molecular machinery moving along the DNA strand. Penalize if:
   - RNA polymerase is described as copying both DNA strands simultaneously (it reads one template strand)
   - The process confuses transcription with translation (transcription produces mRNA; translation produces proteins)

2. DEPTH CHECK: Penalize if the process is presented as simply "DNA is copied to RNA" without showing the unwinding, reading, and assembly happening in sequence.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT RNA polymerase, nucleotides, and promoters ARE. This should show HOW they move, bind, assemble, and release in the active process.

${SHARED_EXPECTATIONS}
    `,
    id: "en-biology-dna-transcription",
    userInput: {
      chapterTitle: "Molecular Biology",
      courseTitle: "Cell Biology",
      explanationSteps: [
        {
          text: "RNA polymerase is the molecular machine that reads DNA and builds RNA. It's a large protein complex that moves along the DNA strand.",
          title: "The Transcription Machine",
        },
        {
          text: "Promoters are special DNA sequences that signal 'start here.' They tell RNA polymerase exactly where to begin reading a gene.",
          title: "Start Signals",
        },
        {
          text: "Nucleotides are the building blocks — A, U, G, C for RNA. Each matches a complementary base on the DNA template being read.",
          title: "The Building Blocks",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how genetic information flows from DNA to messenger RNA through the transcription process",
      lessonTitle: "DNA Transcription",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: HTTP requests involve specific phases with distinct purposes. Penalize if:
   - The handshake is described as happening after data transfer begins (handshake establishes connection first)
   - DNS resolution is skipped or placed incorrectly in the sequence

2. DEPTH CHECK: Penalize if the explanation presents it as "browser asks, server responds" without showing the layered network operations that make this possible.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT HTTP methods, status codes, and headers ARE. This should show HOW a request travels, transforms, and returns through the network stack.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-http-request-flow",
    userInput: {
      chapterTitle: "Web Protocols",
      courseTitle: "Web Development Fundamentals",
      explanationSteps: [
        {
          text: "HTTP methods define what action you want — GET retrieves data, POST sends data, PUT updates, DELETE removes. Each tells the server your intent.",
          title: "Request Methods",
        },
        {
          text: "Status codes are three-digit responses from the server. 200 means success, 404 means not found, 500 means server error. They summarize what happened.",
          title: "Response Codes",
        },
        {
          text: "Headers carry metadata about the request and response — content type, authentication tokens, caching rules. They travel alongside the main data.",
          title: "Headers as Metadata",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding the complete lifecycle of an HTTP request from browser to server and back",
      lessonTitle: "The HTTP Request Lifecycle",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Garbage collection involves specific phases that must occur in order. Penalize if:
   - Objects are described as being freed while still reachable (only unreachable objects are collected)
   - The marking phase is confused with the sweeping phase (marking identifies live objects; sweeping reclaims dead ones)

2. DEPTH CHECK: Penalize if garbage collection is presented as "automatic memory cleanup" without showing how the runtime traces references and determines what to keep.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT the heap, stack, and references ARE. This should show HOW the garbage collector actively scans, marks, and reclaims memory.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-garbage-collection",
    userInput: {
      chapterTitle: "Memory Management",
      courseTitle: "Programming Language Internals",
      explanationSteps: [
        {
          text: "The heap is where dynamically allocated objects live. Unlike the stack, objects here persist until explicitly freed or garbage collected.",
          title: "The Heap",
        },
        {
          text: "References are pointers to objects in memory. When nothing references an object anymore, it becomes eligible for garbage collection.",
          title: "Object References",
        },
        {
          text: "Root objects are the starting points — global variables, stack variables, CPU registers. Everything reachable from roots is considered alive.",
          title: "GC Roots",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how automatic garbage collection identifies and reclaims unused memory in managed runtimes",
      lessonTitle: "How Garbage Collection Works",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Photosynthesis light reactions involve electron flow through specific complexes. Penalize if:
   - ATP is described as being produced by chlorophyll directly (ATP synthase produces ATP using the proton gradient)
   - Water splitting is placed after the electron transport chain (it happens at Photosystem II to replace lost electrons)

2. DEPTH CHECK: Penalize if the explanation treats it as "light makes energy" without showing the cascade of electron transfers and proton pumping.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT chlorophyll, photosystems, and ATP synthase ARE. This should show HOW light energy drives electron flow and creates the proton gradient.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biology-photosynthesis-light",
    userInput: {
      chapterTitle: "Biologia Celular",
      courseTitle: "Biologia Vegetal",
      explanationSteps: [
        {
          text: "A clorofila e o pigmento verde que captura luz. Ela absorve principalmente luz vermelha e azul, refletindo verde — por isso as plantas parecem verdes.",
          title: "Clorofila",
        },
        {
          text: "Os fotossistemas sao complexos de proteinas nas membranas dos tilacoides. Fotossistema I e II trabalham juntos para capturar energia luminosa.",
          title: "Fotossistemas",
        },
        {
          text: "A ATP sintase e uma turbina molecular que produz ATP. Ela usa o gradiente de protons para fosforilar ADP em ATP, a moeda energetica celular.",
          title: "ATP Sintase",
        },
      ],
      language: "pt",
      lessonDescription:
        "Entendendo como a fase clara da fotossintese converte energia luminosa em energia quimica atraves do transporte de eletrons",
      lessonTitle: "Reacoes Luminosas da Fotossintese",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Market price discovery involves buyers and sellers adjusting behavior based on signals. Penalize if:
   - Prices are described as being set by a central authority (in free markets, prices emerge from decentralized interactions)
   - Supply and demand are described as static rather than dynamically adjusting

2. DEPTH CHECK: Penalize if the explanation presents it as "supply meets demand" without showing the iterative signaling and adjustment process.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT supply curves, demand curves, and equilibrium ARE. This should show HOW individual decisions aggregate into market prices through continuous adjustment.

${SHARED_EXPECTATIONS}
    `,
    id: "es-economics-price-discovery",
    userInput: {
      chapterTitle: "Mercados y Precios",
      courseTitle: "Economia Basica",
      explanationSteps: [
        {
          text: "La curva de oferta muestra cuanto produciran los vendedores a cada precio. Precios mas altos incentivan mayor produccion porque aumentan las ganancias potenciales.",
          title: "Curva de Oferta",
        },
        {
          text: "La curva de demanda muestra cuanto compraran los consumidores a cada precio. Precios mas bajos aumentan la cantidad demandada porque el producto se vuelve mas accesible.",
          title: "Curva de Demanda",
        },
        {
          text: "El equilibrio es el punto donde oferta y demanda se cruzan. A este precio, la cantidad que los vendedores quieren vender iguala lo que los compradores quieren comprar.",
          title: "Punto de Equilibrio",
        },
      ],
      language: "es",
      lessonDescription:
        "Entendiendo como los precios de mercado emergen de las interacciones entre compradores y vendedores",
      lessonTitle: "El Proceso de Descubrimiento de Precios",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Nuclear fission chain reactions require specific conditions to sustain. Penalize if:
   - Neutrons are described as being absorbed by all materials equally (only fissile materials sustain the chain)
   - Critical mass is described as a fixed number rather than depending on geometry and material purity

2. DEPTH CHECK: Penalize if the explanation treats it as "atoms split and release energy" without showing how one fission event triggers the next.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT fissile materials, neutrons, and binding energy ARE. This should show HOW the chain reaction propagates and either runs away or remains controlled.

${SHARED_EXPECTATIONS}
    `,
    id: "en-physics-fission-chain",
    userInput: {
      chapterTitle: "Nuclear Physics",
      courseTitle: "Modern Physics",
      explanationSteps: [
        {
          text: "Fissile materials like U-235 have nuclei that split when struck by neutrons. Not all heavy elements are fissile — it depends on nuclear structure.",
          title: "Fissile Materials",
        },
        {
          text: "Neutrons are uncharged particles that can penetrate nuclei. When absorbed by fissile atoms, they destabilize the nucleus and trigger fission.",
          title: "Neutrons as Triggers",
        },
        {
          text: "Binding energy is the glue holding nuclei together. When fission occurs, some mass converts to energy according to E=mc2, releasing enormous power.",
          title: "Energy Release",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how nuclear fission chain reactions start, propagate, and are controlled or allowed to run away",
      lessonTitle: "Nuclear Fission Chain Reactions",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Electromagnetic induction requires changing magnetic flux, not static fields. Penalize if:
   - A stationary magnet in a stationary coil is described as inducing current (relative motion or changing flux is required)
   - The direction of induced current is described incorrectly relative to the field change (Lenz's law)

2. DEPTH CHECK: Penalize if the explanation presents it as "magnets make electricity" without showing how motion or changing flux creates the EMF.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT magnetic flux, EMF, and Faraday's law ARE. This should show HOW moving conductors or changing fields actively induce current.

${SHARED_EXPECTATIONS}
    `,
    id: "en-physics-electromagnetic-induction",
    userInput: {
      chapterTitle: "Electromagnetism",
      courseTitle: "Physics Fundamentals",
      explanationSteps: [
        {
          text: "Magnetic flux measures how much magnetic field passes through a surface. It depends on field strength, area, and the angle between them.",
          title: "Magnetic Flux",
        },
        {
          text: "EMF (electromotive force) is the voltage that drives current. In induction, changing magnetic flux creates this voltage without any battery.",
          title: "Induced EMF",
        },
        {
          text: "Faraday's law states that induced EMF equals the rate of change of magnetic flux. Faster changes produce larger voltages.",
          title: "Faraday's Law",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how changing magnetic fields induce electric currents in conductors",
      lessonTitle: "Electromagnetic Induction",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Enzyme catalysis involves specific binding and conformational changes. Penalize if:
   - Enzymes are described as being consumed in the reaction (they are catalysts and are regenerated)
   - The lock-and-key model is presented without acknowledging induced fit (modern understanding includes conformational change)

2. DEPTH CHECK: Penalize if the explanation treats it as "enzymes speed up reactions" without showing the molecular dance of binding, catalysis, and release.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT active sites, substrates, and activation energy ARE. This should show HOW enzymes grab substrates, lower barriers, and release products.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-chemistry-enzyme-catalysis",
    userInput: {
      chapterTitle: "Bioquimica",
      courseTitle: "Quimica Organica",
      explanationSteps: [
        {
          text: "O sitio ativo e a regiao da enzima onde a catalise acontece. Sua forma tridimensional complementa o substrato, permitindo ligacao especifica.",
          title: "Sitio Ativo",
        },
        {
          text: "Substratos sao as moleculas que as enzimas transformam. Eles se ligam ao sitio ativo e passam pela reacao quimica catalisada.",
          title: "Substratos",
        },
        {
          text: "A energia de ativacao e a barreira energetica que as reacoes precisam superar. Enzimas reduzem essa barreira, acelerando reacoes milhoes de vezes.",
          title: "Energia de Ativacao",
        },
      ],
      language: "pt",
      lessonDescription:
        "Entendendo o processo molecular pelo qual enzimas catalisam reacoes bioquimicas",
      lessonTitle: "Como Enzimas Catalisam Reacoes",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Electrolysis involves specific electrode reactions with correct ion migration. Penalize if:
   - Cations are described as moving to the anode (cations move to the cathode; anions move to the anode)
   - The process is described as spontaneous (electrolysis requires external energy input)

2. DEPTH CHECK: Penalize if the explanation treats it as "electricity splits compounds" without showing the ion migration and electrode reactions.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT electrodes, electrolytes, and ions ARE. This should show HOW the electric current drives ion movement and forces non-spontaneous reactions.

${SHARED_EXPECTATIONS}
    `,
    id: "es-chemistry-electrolysis",
    userInput: {
      chapterTitle: "Electroquimica",
      courseTitle: "Quimica General",
      explanationSteps: [
        {
          text: "Los electrodos son conductores que conectan el circuito externo con la solucion. El catodo es negativo y el anodo es positivo.",
          title: "Electrodos",
        },
        {
          text: "Los electrolitos son sustancias que se disocian en iones cuando se disuelven. Estos iones libres permiten que la corriente fluya a traves de la solucion.",
          title: "Electrolitos",
        },
        {
          text: "Los iones son atomos o moleculas con carga electrica. Los cationes tienen carga positiva, los aniones tienen carga negativa.",
          title: "Iones",
        },
      ],
      language: "es",
      lessonDescription:
        "Entendiendo como la corriente electrica fuerza reacciones quimicas no espontaneas en celdas electroliticas",
      lessonTitle: "El Proceso de Electrolisis",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Monetary policy transmission involves multiple channels with time lags. Penalize if:
   - Interest rate changes are described as immediately affecting inflation (transmission takes 12-24 months)
   - The central bank is described as directly controlling commercial interest rates (it influences them through the policy rate)

2. DEPTH CHECK: Penalize if the explanation treats it as "central bank changes rates, economy responds" without showing the chain of effects through banks, lending, spending, and prices.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT policy rates, reserve requirements, and open market operations ARE. This should show HOW policy changes ripple through the financial system to affect the real economy.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-monetary-transmission",
    userInput: {
      chapterTitle: "Macroeconomic Policy",
      courseTitle: "Economics",
      explanationSteps: [
        {
          text: "The policy rate is the interest rate the central bank charges commercial banks. It serves as the baseline for all other rates in the economy.",
          title: "Policy Rate",
        },
        {
          text: "Reserve requirements determine what fraction of deposits banks must hold. Lower requirements mean banks can lend more of their deposits.",
          title: "Reserve Requirements",
        },
        {
          text: "Open market operations involve buying and selling government bonds. Purchases inject money into the economy; sales withdraw it.",
          title: "Open Market Operations",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how central bank policy decisions transmit through the financial system to affect economic activity and inflation",
      lessonTitle: "Monetary Policy Transmission",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: The compilation pipeline has distinct phases that must occur in order. Penalize if:
   - Optimization is described as happening before parsing (parsing must occur first to create the IR)
   - Lexical analysis and parsing are conflated (lexing produces tokens; parsing builds the AST)

2. DEPTH CHECK: Penalize if the explanation treats it as "code becomes machine code" without showing how each phase transforms the representation.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT tokens, ASTs, and intermediate representations ARE. This should show HOW the compiler actively transforms code through each phase.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-compilation-pipeline",
    userInput: {
      chapterTitle: "Language Implementation",
      courseTitle: "Compiler Design",
      explanationSteps: [
        {
          text: "Tokens are the smallest meaningful units of code — keywords, identifiers, operators, literals. The lexer breaks source code into this stream of tokens.",
          title: "Tokens",
        },
        {
          text: "The AST (Abstract Syntax Tree) represents code structure hierarchically. It captures how expressions nest and statements compose.",
          title: "Abstract Syntax Tree",
        },
        {
          text: "Intermediate representation (IR) is a platform-independent format. It's lower-level than the AST but higher-level than machine code.",
          title: "Intermediate Representation",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how compilers transform source code through multiple phases of analysis and synthesis",
      lessonTitle: "The Compilation Pipeline",
    },
  },
];
