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

   IMPORTANT - "Novel" means a different conceptual context, not just swapping a superficial detail. For technical subjects, using a different specific instance of the same error type (e.g., missing brace vs missing parenthesis) still tests the same concept and is acceptable. What matters is that the learner must APPLY understanding, not recall a specific example from the text.

   DOMAIN TERMINOLOGY: Using standard domain terminology (e.g., "innate/adaptive immunity" in biology, "abstract syntax tree" in compilers, "credit assignment" in ML) is acceptable and even desirable, even if the simplified explanation didn't use those exact terms. Do NOT penalize for introducing correct field-standard vocabulary. Only penalize when questions test recall of explanation-SPECIFIC phrasing, metaphors, or invented analogies.

3. FORMAT APPROPRIATENESS: Evaluate whether the chosen format genuinely tests understanding.

   ANTI-PATTERN - "Forced variety": Using different formats just for variety is a serious flaw. Multiple well-crafted questions of the same format are better than poorly-suited formats used for variety's sake. Do NOT penalize for using multiple choice repeatedly if it tests the concepts well.

   Format guidance:
   - Multiple choice: Often the BEST choice, not just a "default." It excels at testing whether learners can apply concepts to novel scenarios. Use it freely.
   - Match columns: Best when the concept involves connecting observations to principles (symptoms to causes, effects to mechanisms).
   - Sort order: ONLY when the concept IS about sequence — when order matters conceptually (biological processes, compilation phases).
   - Fill blank: Best for completing relationships or processes where the blank tests conceptual understanding.
   - Select image: ONLY when visual recognition genuinely tests understanding.

   PENALIZE when:
   - Formats are used for variety rather than fit
   - A different format would clearly test the concept better

   Do NOT penalize when:
   - Multiple choice is used repeatedly across several questions
   - Some available formats are not used at all
   - The quiz sticks to one or two well-suited formats

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

BINARY CHECKS:
- "Memorization vs understanding" is checked by: does the question reference the explanation text directly or present a novel scenario? Direct text references = penalize. Novel scenarios = do not penalize.
- Question count is not strictly enforced in this task - quality over quantity. Only penalize if the count is drastically low (under 5).
- Format choice is only penalized when the format CANNOT test the concept (e.g., sort_order for a non-sequential concept). Repeated use of a well-suited format is NOT penalizable.
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios where someone encounters a networking issue and must reason about encapsulation layers or forwarding constraints to diagnose it
   - GOOD PATTERN: Situations requiring prediction of what happens when MTU limits are exceeded or headers are corrupted
   - BAD PATTERN: Asking to name network layers or define encapsulation without application context
   - BAD PATTERN: Questions referencing specific metaphors from the explanation

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Routers examining application-layer data for forwarding decisions (they typically only look at network-layer headers)
   - Encapsulation adding headers only at the source (headers are added and removed at each layer boundary)
   - All network devices seeing the complete data payload (each device only processes its relevant layer)

3. FORMAT FIT: Multiple choice works well for "what would happen if..." networking scenarios. Sort order could work for encapsulation layer sequence.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-data-movement-quiz",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "Encapsulation wraps data with headers at each network layer. Each layer adds its own addressing and control information, like putting a letter in a series of labeled envelopes.",
          title: "Encapsulation",
        },
        {
          text: "Each network device along the path reads only its layer's header, makes a forwarding decision, and passes the data to the next hop. No device sees the full picture.",
          title: "Hop-by-Hop Forwarding",
        },
        {
          text: "The maximum transmission unit limits how much data fits in a single frame. Data larger than the MTU must be fragmented into smaller pieces for transit.",
          title: "Size Constraints",
        },
      ],
      language: "en",
      lessonDescription:
        "Core building blocks for how data moves across networks, from encapsulation to hop-by-hop forwarding constraints.",
      lessonTitle: "How Data Moves on Networks",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Code scenarios where learners must predict outcomes of float arithmetic or bool operations based on understanding the type hierarchy
   - GOOD PATTERN: Situations requiring understanding of WHY True + True equals 2 or why 0.1 + 0.2 != 0.3
   - BAD PATTERN: Asking to define float or bool without application context
   - BAD PATTERN: Questions that test recall of specific syntax rather than type behavior

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Float arithmetic being exact (floating-point has inherent precision limitations)
   - Bool being a completely separate type from int (it is a subclass)
   - True + True equaling True (it equals 2 because bool inherits int arithmetic)

3. FORMAT FIT: Multiple choice works well for "what does this expression evaluate to" scenarios. Fill blank works for type relationship questions.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool-quiz",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      explanationSteps: [
        {
          text: "Floats representam números com parte decimal usando ponto flutuante. A notação 3.14 ou 2.0e10 cria literais float em Python.",
          title: "Literais Float",
        },
        {
          text: "Bool é uma subclasse de int em Python. True equivale a 1 e False equivale a 0, permitindo operações aritméticas diretas com booleanos.",
          title: "Bool como Inteiro",
        },
      ],
      language: "pt",
      lessonDescription:
        "Valores de ponto flutuante e booleanos, sintaxe de literais e a relação estrutural entre bool e int.",
      lessonTitle: "Float e bool como tipos numéricos",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios presenting economic data where learners must identify which labor market indicator would move first or explain why unemployment lags GDP
   - GOOD PATTERN: Situations requiring understanding of why the unemployment rate can understate labor market weakness
   - BAD PATTERN: Asking to define unemployment rate or labor force participation without application context
   - BAD PATTERN: Questions testing recall of specific statistics

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Unemployment moving simultaneously with GDP (it typically lags)
   - Discouraged workers being counted in the unemployment rate (they are not, by definition)
   - Hours worked adjustments happening after layoffs (hours typically adjust first)

3. FORMAT FIT: Multiple choice works well for interpreting economic scenarios. Match columns work for connecting indicators to their cyclical behavior.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-cycles-quiz",
    userInput: {
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      explanationSteps: [
        {
          text: "The unemployment rate measures the share of the labor force actively seeking work but unable to find it. It rises during recessions but typically lags behind GDP declines.",
          title: "Unemployment Rate",
        },
        {
          text: "Average hours worked per employee often fall before headcount does. Firms reduce overtime first, making hours a leading indicator of labor market stress.",
          title: "Hours Worked",
        },
        {
          text: "Labor force participation measures who is working or looking for work. It drops during prolonged downturns as discouraged workers stop searching entirely.",
          title: "Participation Rate",
        },
      ],
      language: "en",
      lessonDescription:
        "Empirical regularities linking downturns to labor market outcomes at the level of aggregate fluctuations, without modeling search or wage-setting mechanisms.",
      lessonTitle: "Labor market aggregates over the cycle",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Reaction scenarios where learners must predict which hydrogen would be abstracted or whether a given substrate can form an enolate
   - GOOD PATTERN: Situations requiring understanding of why enolates attack at carbon rather than oxygen in certain conditions
   - BAD PATTERN: Asking to define enolate or α-hydrogen without application context
   - BAD PATTERN: Questions about resonance structures without practical synthesis context

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Enolates acting as electrophiles (they are nucleophiles)
   - All C–H bonds adjacent to carbonyls being equally acidic (acidity depends on additional stabilizing groups)
   - Resonance stabilization occurring before deprotonation (it is a consequence of deprotonation)

3. FORMAT FIT: Multiple choice works for reaction prediction scenarios. Match columns work for connecting substrate types to their enolate reactivity.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-acidez-enolatos-quiz",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      explanationSteps: [
        {
          text: "Los hidrógenos en posición α, junto al carbonilo, son inusualmente ácidos. La base sustrae este hidrógeno y el par de electrones se deslocaliza hacia el oxígeno del carbonilo.",
          title: "Acidez en Posición α",
        },
        {
          text: "El enolato resultante es un carbanión estabilizado por resonancia. La carga negativa se reparte entre el carbono α y el oxígeno, creando un nucleófilo ambidente.",
          title: "Estabilización por Resonancia",
        },
        {
          text: "Como nucleófilo, el enolato ataca electrófilos en el carbono α, formando nuevos enlaces C–C. Esta reactividad es la base de condensaciones aldólicas y de Claisen.",
          title: "Enolato como Nucleófilo",
        },
      ],
      language: "es",
      lessonDescription:
        "Origen de la acidez en α y cómo se forma el enolato como nucleófilo clave en reacciones de construcción C–C.",
      lessonTitle: "Acidez en α y formación de enolatos",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios where a law firm discovers automated document errors and must reason about which metrics would have caught the problem
   - GOOD PATTERN: Situations requiring understanding of why audit trails matter for compliance and error diagnosis
   - BAD PATTERN: Asking to list types of metrics without application context
   - BAD PATTERN: Questions about specific software tools rather than measurement concepts

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - Monitoring being a one-time setup rather than ongoing (it requires continuous measurement)
   - Audit trails only recording the final document (they should capture the entire generation pipeline)
   - Quality metrics focusing only on formatting (they should also cover content accuracy and completeness)

3. FORMAT FIT: Multiple choice works for diagnostic scenarios. Match columns work for connecting error types to the metrics that detect them.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-automacao-quiz",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      courseTitle: "Direito",
      explanationSteps: [
        {
          text: "Métricas de qualidade medem a taxa de erros em documentos automatizados — cláusulas faltantes, dados incorretos ou formatação quebrada. Cada erro é classificado por gravidade.",
          title: "Métricas de Qualidade",
        },
        {
          text: "Rastros de auditoria registram cada etapa da geração documental: quem solicitou, qual template foi usado, quais dados alimentaram o documento e quando foi revisado.",
          title: "Rastros de Auditoria",
        },
      ],
      language: "pt",
      lessonDescription:
        "Métricas operacionais focadas em qualidade e segurança da automação documental, com rastros para auditoria.",
      lessonTitle: "Medição e monitoramento da automação",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. APPLICATION CHECK:
   - GOOD PATTERN: Scenarios presenting connectivity symptoms where learners must reason about which network layer is likely at fault
   - GOOD PATTERN: Situations requiring understanding of WHY testing the gateway first eliminates local network issues before investigating remote paths
   - BAD PATTERN: Asking to list debugging steps without a scenario
   - BAD PATTERN: Questions testing recall of specific tool commands rather than reasoning about layers

2. ACCURACY PITFALLS - Penalize if any of these are stated or implied:
   - DNS failures meaning the physical network is down (DNS is a service-layer issue; the network may be fine)
   - Gateway reachability proving the destination is reachable (it only proves the local subnet works)
   - All connectivity problems being diagnosable from the client side (some require server-side investigation)
   - Debugging always proceeding bottom-up (sometimes symptoms clearly point to a specific layer)

3. FORMAT FIT: Multiple choice works well for "given these symptoms, which layer is likely at fault" scenarios. Sort order could work for the systematic debugging sequence.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-debugging-mental-models-quiz",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "Start at the host: check if the network interface is up and has a valid IP. If the machine itself is misconfigured, nothing beyond it will work.",
          title: "Host-Level Check",
        },
        {
          text: "Test the local subnet by reaching the default gateway. If this fails, the problem is between your machine and the first router — a local network issue.",
          title: "Subnet and Gateway",
        },
        {
          text: "If the gateway responds but the destination doesn't, the problem is somewhere along the path — a routing issue, a firewall, or the remote host itself.",
          title: "Path and Service Layer",
        },
      ],
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
    },
  },
];
