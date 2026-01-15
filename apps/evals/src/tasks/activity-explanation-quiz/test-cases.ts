const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. UNDERSTANDING OVER MEMORIZATION: Questions must test conceptual understanding, not recall. A learner who understood the concept but never read this specific explanation should be able to answer correctly. Penalize questions that:
   - Use phrases like "according to the text," "as described," or "the explanation said"
   - Reference specific metaphors, analogies, or examples from the explanation steps
   - Ask "what is X?" instead of "what would happen if..." or "which scenario shows..."

2. APPLICATION TO NOVEL SCENARIOS: Questions should present concepts in new contexts the learner hasn't seen. The scenario in the question should be different from any examples in the explanation steps. Penalize questions that:
   - Reuse scenarios from the explanation
   - Ask about facts that could only be known by reading this specific text
   - Test vocabulary definitions rather than concept application

3. FORMAT APPROPRIATENESS: The format should match what the concept requires:
   - Multiple choice (default): Best for applying concepts to scenarios
   - Match columns: Best for connecting concepts to real-world manifestations
   - Sort order: Best for processes where sequence matters
   - Fill blank: Best for understanding relationships within processes
   - Arrange words: Best for constructing key insights
   - Select image: ONLY when visual recognition genuinely tests understanding
   Penalize when a different format would clearly test the concept better.

4. FEEDBACK QUALITY: Feedback must explain reasoning, not just state correct/incorrect. Good feedback:
   - For correct answers: Explains WHY it's right plus an additional insight
   - For incorrect answers: Explains WHY it's wrong AND why the correct answer is right
   Penalize feedback that only says "Correct!" or "That's wrong."

5. FACTUAL ACCURACY: All questions and answers must be scientifically/technically correct. Penalize:
   - Incorrect facts presented as correct answers
   - Correct facts marked as incorrect
   - Misleading simplifications that create misconceptions

6. QUESTION CLARITY: Questions must be unambiguous with a conversational tone. Penalize:
   - Academic or formal phrasing
   - Ambiguous scenarios where multiple answers could be valid
   - Trick questions designed to confuse rather than test understanding

7. APPROPRIATE DIFFICULTY: Questions should challenge understanding without being unfair. Penalize:
   - Trivially easy questions anyone could guess
   - Questions requiring knowledge beyond the lesson scope
   - Trick questions that test careful reading rather than comprehension

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing specific question formats you might expect
- Do NOT require a specific number of questions - quality matters more than quantity
- Do NOT check against an imagined "complete" quiz you think should exist
- Do NOT penalize for covering some concepts more than others if coverage is reasonable
- Do NOT expect questions to follow any particular order or progression
- ONLY penalize for: memorization-based questions, factual errors, poor feedback quality, unclear wording, or inappropriate format choices
- Different valid quiz designs exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios where someone observes immune responses in everyday life (repeat exposure, recovery time, vaccination effects) and must explain the underlying mechanism
   - GOOD PATTERN: Situations requiring prediction of immune outcomes based on understanding defense layers
   - BAD PATTERN: Asking to name cells, list defense mechanisms, or recall definitions without application context
   - BAD PATTERN: Questions referencing specific metaphors or examples from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Antibodies directly killing pathogens (they MARK pathogens for destruction by other cells like macrophages)
   - White blood cells being a single type (there are many types with different functions)
   - Immune response being immediate (innate response is fast, adaptive takes days)
   - Fever being harmful (it's often a beneficial immune response)

3. FORMAT FIT: Multiple choice works well for "which scenario shows X mechanism." Match columns work for connecting symptoms to immune responses. Sort order works for immune response sequence.

${SHARED_EXPECTATIONS}
    `,
    id: "en-biology-immune-system-quiz",
    userInput: {
      chapterTitle: "Body Systems",
      courseTitle: "Human Biology",
      explanationSteps: [
        {
          text: "Your body has two defense systems working together. The first responds instantly to any threat. The second takes time but remembers enemies forever.",
          title: "Two Lines of Defense",
        },
        {
          text: "Physical barriers like skin and mucus stop most invaders. If they get through, patrolling cells called macrophages eat anything that looks foreign.",
          title: "The First Responders",
        },
        {
          text: "When threats persist, specialized cells called B cells create antibodies. These Y-shaped proteins stick to specific invaders, marking them for destruction.",
          title: "The Targeting System",
        },
        {
          text: "Some cells become memory cells after an infection. They remember the invader's shape for years, letting your body respond faster next time.",
          title: "Remembering Enemies",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how the immune system protects the body through multiple layers of defense, from physical barriers to specialized cells and antibodies",
      lessonTitle: "How the Immune System Works",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios involving code errors where learners must identify which compilation phase would catch or miss them
   - GOOD PATTERN: Situations requiring understanding of why phases must occur in a specific order
   - BAD PATTERN: Asking to list phases, name outputs, or define terminology without application context
   - BAD PATTERN: Questions about the "assembly line" metaphor or other explanation-specific content

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Lexical analysis and parsing being the same thing (lexical analysis produces tokens; parsing builds syntax trees from tokens)
   - Compilers only producing machine code (many produce bytecode or intermediate representations)
   - Optimization being optional or unimportant (it's crucial for performance)
   - Semantic analysis happening before parsing (parsing must complete first)

3. FORMAT FIT: Sort order works well for compiler pipeline stages. Match columns work for connecting error types to phases. Multiple choice for "which phase catches this error."

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-compilers-quiz",
    userInput: {
      chapterTitle: "Language Implementation",
      courseTitle: "Programming Language Theory",
      explanationSteps: [
        {
          text: "A compiler reads your code in stages, like an assembly line. Each stage transforms the code into something closer to what the machine understands.",
          title: "The Assembly Line",
        },
        {
          text: "First, lexical analysis breaks your code into tokens - the smallest meaningful units. Keywords, variables, and operators each become distinct pieces.",
          title: "Breaking into Tokens",
        },
        {
          text: "The parser takes those tokens and builds a tree structure showing how statements relate. This catches syntax errors like missing parentheses.",
          title: "Building Structure",
        },
        {
          text: "Semantic analysis checks if your code makes logical sense. It catches errors like using a string where a number is required.",
          title: "Checking Meaning",
        },
        {
          text: "Finally, code generation translates the validated structure into machine instructions the processor can execute directly.",
          title: "Generating Output",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how compilers transform human-readable code into machine-executable instructions through multiple phases of analysis and transformation",
      lessonTitle: "How Compilers Work",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios involving economic decisions (borrowing, spending, saving) where learners must predict effects of interest rate changes
   - GOOD PATTERN: Situations requiring understanding of transmission delays between policy and economic outcomes
   - BAD PATTERN: Asking to list monetary tools or define economic terms without application context
   - BAD PATTERN: Questions referencing specific examples from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Interest rate changes having immediate effects (transmission mechanisms have significant time lags of 6-18 months)
   - Central banks directly controlling inflation (they influence it through indirect mechanisms)
   - Lower interest rates always being good (they can fuel inflation and asset bubbles)
   - Monetary policy being the only tool for economic stability (fiscal policy also plays a role)

3. FORMAT FIT: Multiple choice works for cause-effect scenarios. Match columns work for connecting policy actions to economic effects. Sort order can work for transmission mechanism sequences.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-economics-monetary-policy-quiz",
    userInput: {
      chapterTitle: "Macroeconomia",
      courseTitle: "Economia para Iniciantes",
      explanationSteps: [
        {
          text: "O banco central controla a quantidade de dinheiro circulando na economia. Quando ha dinheiro demais, os precos sobem. Quando ha pouco, a economia desacelera.",
          title: "Equilibrio Monetario",
        },
        {
          text: "A taxa basica de juros e a principal ferramenta. Juros altos tornam emprestimos caros, reduzindo gastos. Juros baixos estimulam emprestimos e consumo.",
          title: "A Alavanca dos Juros",
        },
        {
          text: "Mudancas nos juros levam meses para afetar a economia real. Empresas e consumidores ajustam seus planos gradualmente, nao instantaneamente.",
          title: "Efeito com Atraso",
        },
        {
          text: "Bancos centrais tambem compram e vendem titulos do governo. Comprando titulos, injetam dinheiro na economia. Vendendo, retiram dinheiro de circulacao.",
          title: "Operacoes de Mercado",
        },
      ],
      language: "pt",
      lessonDescription:
        "Entendendo como bancos centrais usam taxas de juros e outras ferramentas para influenciar a economia, incluindo os mecanismos de transmissao da politica monetaria",
      lessonTitle: "Como Funciona a Politica Monetaria",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Security scenarios where learners must apply hash properties (irreversibility, avalanche effect, collision resistance) to real situations
   - GOOD PATTERN: Situations requiring understanding of why certain hash behaviors matter for security
   - BAD PATTERN: Asking to list hash properties or define terminology without application context
   - BAD PATTERN: Questions about specific terms like "avalanche effect" without practical application

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Hashing being the same as encryption (hashing is ONE-WAY and irreversible; encryption is designed to be reversible with a key)
   - Hash functions producing unique outputs (collisions are mathematically possible, just extremely unlikely for good functions)
   - Longer hashes always being more secure (algorithm quality matters more than length)
   - MD5 or SHA-1 being secure for cryptographic purposes (both have known vulnerabilities)

3. FORMAT FIT: Multiple choice works for security scenarios. Match columns work for connecting hash properties to their practical implications.

${SHARED_EXPECTATIONS}
    `,
    id: "es-crypto-hash-functions-quiz",
    userInput: {
      chapterTitle: "Fundamentos de Criptografia",
      courseTitle: "Seguridad Informatica",
      explanationSteps: [
        {
          text: "Una funcion hash convierte cualquier dato en una cadena de longitud fija. Un archivo de 1KB y uno de 1GB producen hashes del mismo tamano.",
          title: "Compresion de Datos",
        },
        {
          text: "Cambiar un solo bit del archivo original cambia completamente el hash. Esta propiedad se llama efecto avalancha y es crucial para detectar alteraciones.",
          title: "Sensibilidad Extrema",
        },
        {
          text: "No puedes recuperar el archivo original desde su hash - el proceso es irreversible. Por eso se usan para almacenar contrasenas de forma segura.",
          title: "Camino de Ida",
        },
        {
          text: "Encontrar dos archivos diferentes con el mismo hash deberia ser practicamente imposible. Esta resistencia a colisiones es lo que hace a los hashes confiables.",
          title: "Unicidad Practica",
        },
      ],
      language: "es",
      lessonDescription:
        "Entendiendo como funcionan las funciones hash criptograficas, sus propiedades matematicas, y por que son fundamentales para la seguridad digital",
      lessonTitle: "Funciones Hash Criptograficas",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Training scenarios where learners must diagnose what's happening (overfitting, underfitting, vanishing gradients) based on observed behavior
   - GOOD PATTERN: Situations requiring understanding of why the forward-backward process produces learning
   - BAD PATTERN: Asking for formulas, definitions, or terminology without application context
   - BAD PATTERN: Questions about specific metaphors like "blame assignment" from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Gradient descent being random trial and error (it follows the mathematical gradient direction)
   - Neural networks understanding concepts like humans (they learn statistical patterns)
   - More layers always being better (can cause vanishing gradients and overfitting)
   - Training stopping when error reaches zero (this indicates overfitting)

3. FORMAT FIT: Multiple choice works for training scenarios. Sort order can work for the forward-backward pass sequence. Fill blank can work for the gradient flow process.

${SHARED_EXPECTATIONS}
    `,
    id: "en-ml-backpropagation-quiz",
    userInput: {
      chapterTitle: "Neural Network Training",
      courseTitle: "Machine Learning Fundamentals",
      explanationSteps: [
        {
          text: "Training a neural network means adjusting connection strengths so outputs match desired results. The question is: which connections need adjusting and by how much?",
          title: "The Adjustment Problem",
        },
        {
          text: "First, data flows forward through the network, producing a prediction. The difference between prediction and reality is measured as error.",
          title: "Measuring Mistakes",
        },
        {
          text: "Error information then flows backward through the network. Each connection learns how much it contributed to the mistake using calculus.",
          title: "Assigning Blame",
        },
        {
          text: "Connections that contributed more to errors get larger adjustments. The network gradually improves by making small changes in the direction that reduces error.",
          title: "Small Steps Downhill",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how neural networks learn through backpropagation, including forward passes, loss calculation, and gradient-based weight updates",
      lessonTitle: "How Neural Networks Learn",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Geographic scenarios where learners must explain geological features or patterns based on plate interactions
   - GOOD PATTERN: Situations requiring prediction of geological activity based on understanding boundary types
   - BAD PATTERN: Asking to name boundary types or list geological features without application context
   - BAD PATTERN: Questions referencing the "cracked shell" or "engine below" metaphors from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - The mantle being liquid or molten (it is SOLID rock that flows very slowly over geological time due to heat and pressure)
   - Plates floating on liquid (they move on the slowly-flowing solid mantle)
   - Earthquakes only happening at plate boundaries (intraplate earthquakes exist)
   - Continental drift being the same as plate tectonics (continental drift was the early theory; plate tectonics is the modern mechanism)

3. FORMAT FIT: Multiple choice works well for geological scenarios. Match columns work for connecting geological features to boundary types. Sort order could work for mountain-building sequences.

${SHARED_EXPECTATIONS}
    `,
    id: "en-geology-plate-tectonics-quiz",
    userInput: {
      chapterTitle: "Earth's Structure",
      courseTitle: "Earth Science",
      explanationSteps: [
        {
          text: "Earth's outer shell is cracked into massive pieces called plates. These plates sit on the mantle - solid rock so hot it flows like thick honey over millions of years.",
          title: "A Cracked Shell",
        },
        {
          text: "Heat from Earth's core creates circulation in the mantle. This slow churning drags the plates along, moving them centimeters per year.",
          title: "The Engine Below",
        },
        {
          text: "Where plates pull apart, magma rises to fill the gap, creating new crust. Mid-ocean ridges are underwater mountain chains formed this way.",
          title: "Spreading Apart",
        },
        {
          text: "Where plates collide, one may dive under the other, triggering earthquakes and volcanoes. Mountain ranges like the Himalayas form when neither plate sinks.",
          title: "Collision Zones",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how Earth's tectonic plates move and interact, including the mechanisms that drive plate motion and the geological features they create",
      lessonTitle: "Plate Tectonics",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios requiring understanding of WHY replication works as it does (directionality constraints, error correction needs)
   - GOOD PATTERN: Situations where learners must predict outcomes of replication errors or enzyme malfunctions
   - BAD PATTERN: Asking to name enzymes or describe their functions without application context
   - BAD PATTERN: Questions referencing the "zipper" metaphor or other explanation-specific content

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Both DNA strands being synthesized the same way (leading strand is continuous; lagging strand is synthesized in Okazaki fragments)
   - DNA polymerase being able to start synthesis on its own (it needs a primer)
   - Replication being error-free (proofreading catches most errors but some slip through)
   - Replication happening randomly along the chromosome (it starts at specific origins)

3. FORMAT FIT: Sort order works well for replication sequence. Fill blank works for enzyme roles. Multiple choice for understanding why the process works as it does.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biology-dna-replication-quiz",
    userInput: {
      chapterTitle: "Genetica Molecular",
      courseTitle: "Biologia Celular",
      explanationSteps: [
        {
          text: "Antes de uma celula se dividir, ela precisa copiar todo seu DNA. O processo comeca quando enzimas separam as duas fitas da dupla helice.",
          title: "Abrindo o Ziper",
        },
        {
          text: "Cada fita original serve de molde para uma nova. Enzimas chamadas DNA polimerases leem a fita antiga e constroem a nova, base por base.",
          title: "Lendo o Molde",
        },
        {
          text: "Ha um problema: a polimerase so consegue adicionar bases em uma direcao. Uma fita e copiada continuamente, mas a outra precisa ser copiada em pedacos.",
          title: "O Problema da Direcao",
        },
        {
          text: "Enzimas de correcao verificam cada base adicionada. Se encontram um erro, removem e substituem. Esse controle de qualidade mantem a fidelidade genetica.",
          title: "Corrigindo Erros",
        },
      ],
      language: "pt",
      lessonDescription:
        "Entendendo o processo de replicacao do DNA, incluindo as enzimas envolvidas e como a informacao genetica e copiada com alta fidelidade",
      lessonTitle: "Como o DNA se Replica",
    },
  },
  {
    expectations: `
SPECIAL CONSIDERATION: This is an edge case - language learning content where the subject (Spanish) is different from the quiz language (English).

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios where learners must apply conjugation patterns to NEW verbs not mentioned in the explanation
   - GOOD PATTERN: Situations requiring understanding of WHY pronoun dropping works in Spanish
   - BAD PATTERN: Asking for specific conjugations of verbs used in the explanation (hablar)
   - BAD PATTERN: Asking to list endings without application to actual communication scenarios

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - All Spanish verbs following the same pattern (irregular verbs exist)
   - Present tense only having one use (it can express habitual actions, current actions, and near future)
   - Verb endings being arbitrary (they follow systematic patterns based on infinitive ending)
   - Spanish having the same subject pronoun rules as English (Spanish often drops subject pronouns)

3. FORMAT FIT: Fill blank works well for completing sentences with correct forms. Match columns work for connecting pronouns to endings. Multiple choice for applying patterns to new verbs.

${SHARED_EXPECTATIONS}
    `,
    id: "en-language-spanish-verbs-quiz",
    userInput: {
      chapterTitle: "Grammar Foundations",
      courseTitle: "Spanish for Beginners",
      explanationSteps: [
        {
          text: "Spanish verbs change their endings based on who's doing the action. The infinitive form - like 'hablar' (to speak) - is the starting point before conjugation.",
          title: "Verbs Change Shape",
        },
        {
          text: "Regular verbs follow predictable patterns. Verbs ending in -AR like 'hablar' use one set of endings. Verbs ending in -ER and -IR use slightly different sets.",
          title: "Three Verb Families",
        },
        {
          text: "For -AR verbs in present tense: remove -AR, then add -o (I), -as (you), -a (he/she), -amos (we), -an (they). So 'hablar' becomes 'hablo' for 'I speak.'",
          title: "The -AR Pattern",
        },
        {
          text: "Spanish often drops the subject pronoun because the verb ending already tells you who's acting. 'Hablo' alone means 'I speak' - no need for 'yo.'",
          title: "Pronouns Are Optional",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how to conjugate regular Spanish verbs in the present tense, including the patterns for -AR, -ER, and -IR verb families",
      lessonTitle: "Spanish Verb Conjugation",
    },
  },
  {
    expectations: `
SPECIAL CONSIDERATION: This is an edge case - a visual/practical skill where understanding is demonstrated through application to real scenarios, not visual recognition.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Photography scenarios where learners must decide subject placement to achieve specific visual effects
   - GOOD PATTERN: Situations requiring understanding of WHY off-center placement creates visual interest
   - BAD PATTERN: Asking to define the rule of thirds or describe the grid without application context
   - BAD PATTERN: Questions about "power points" terminology without practical application

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Rule of thirds being mandatory (it's a guideline, not a rule - breaking it intentionally can be effective)
   - Centered subjects always being wrong (centered composition works for symmetry and certain moods)
   - The grid being visible in final photos (it's an imaginary guide)
   - Rule of thirds being the only composition technique (leading lines, framing, and many others exist)

3. FORMAT FIT: Multiple choice works for "where would you place the subject" scenarios. Match columns could connect composition choices to their visual effects. AVOID selectImage unless visual recognition is truly being tested.

${SHARED_EXPECTATIONS}
    `,
    id: "en-photography-composition-quiz",
    userInput: {
      chapterTitle: "Composition Basics",
      courseTitle: "Photography Fundamentals",
      explanationSteps: [
        {
          text: "Most beginners center their subjects. While this works sometimes, placing subjects off-center often creates more dynamic, interesting images.",
          title: "Beyond the Center",
        },
        {
          text: "Imagine your frame divided by two horizontal and two vertical lines, creating nine equal sections. The four points where lines cross are power points.",
          title: "The Grid",
        },
        {
          text: "Placing your main subject on a power point or along a line draws the viewer's eye naturally. A horizon on the lower line emphasizes sky; on the upper line emphasizes ground.",
          title: "Strategic Placement",
        },
        {
          text: "This guideline works because our eyes naturally scan images in patterns. Off-center placement gives the eye somewhere to travel, making photos feel more alive.",
          title: "Why It Works",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding the rule of thirds and how strategic subject placement creates more visually engaging photographs",
      lessonTitle: "The Rule of Thirds",
    },
  },
  {
    expectations: `
SPECIAL CONSIDERATION: This is an edge case - an abstract psychological concept where understanding means recognizing the bias in everyday situations.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Everyday scenarios where learners must recognize confirmation bias operating in someone's reasoning
   - GOOD PATTERN: Situations requiring understanding of WHY the bias is unconscious and hard to overcome
   - BAD PATTERN: Asking to define confirmation bias or list its characteristics without application context
   - BAD PATTERN: Questions about the sports fan or political supporter examples from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Confirmation bias being intentional deception (it's usually unconscious)
   - Only unintelligent people having confirmation bias (everyone is susceptible, including experts)
   - Confirmation bias being easy to overcome once you know about it (awareness helps but doesn't eliminate it)
   - Confirmation bias only affecting beliefs about facts (it affects emotional and value-based beliefs too)

3. FORMAT FIT: Multiple choice excels here - present scenarios and ask which demonstrates the bias. Match columns could connect cognitive biases to example scenarios. AVOID sort_order as the concept isn't sequential.

${SHARED_EXPECTATIONS}
    `,
    id: "en-psychology-confirmation-bias-quiz",
    userInput: {
      chapterTitle: "Cognitive Biases",
      courseTitle: "Introduction to Psychology",
      explanationSteps: [
        {
          text: "Our brains prefer consistency. When we believe something, finding contradicting evidence feels uncomfortable - like a mental itch we want to scratch away.",
          title: "The Comfort of Consistency",
        },
        {
          text: "To avoid discomfort, our brains play tricks. We notice evidence supporting our beliefs and unconsciously filter out or dismiss contradicting evidence.",
          title: "Selective Attention",
        },
        {
          text: "This happens automatically, not deliberately. A sports fan genuinely sees more fouls by the opposing team. A political supporter honestly remembers more flaws in opponents.",
          title: "Unconscious Filtering",
        },
        {
          text: "Even scientists fall prey to this. That's why research uses blind studies and peer review - external checks against our natural tendency to see what we expect.",
          title: "Safeguards Help",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding confirmation bias - how our tendency to favor information that confirms existing beliefs affects our perception and decision-making",
      lessonTitle: "Confirmation Bias",
    },
  },
];
