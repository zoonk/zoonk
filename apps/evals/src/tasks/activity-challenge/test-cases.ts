const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. DIMENSION QUALITY (MOST IMPORTANT): The challenge must use exactly 2-4 unique dimensions across ALL steps.
   - Count every unique dimension name across the entire output. More than 4 is a violation.
   - Every dimension must appear in at least 2 different steps (a dimension in only 1 step means the learner can't recover from a bad choice — this is a design flaw)
   - Dimensions must be consistently named across all effects (same concept = same name, same spelling, same casing)
   - Dimensions should connect meaningfully to lesson concepts and create natural tension (trade-off axes)

2. CONSEQUENCE QUALITY: Each option's consequence must:
   - Explain what happens as a result of the choice
   - Connect to lesson concepts (not generic outcomes)
   - Teach something about trade-offs
   - Be consistent with the stated effects (if effect is positive for dimension X, consequence should reflect improvement in X)

3. TRADE-OFF DESIGN: No option should be obviously best. Options should affect multiple dimensions with mixed impacts (e.g., positive for one, negative for another). If one option has all positive effects, penalize.

4. EFFECTS CONSISTENCY: Each option should have 1-3 effects. The SAME 2-4 dimension names must be reused across ALL steps. If you see different dimension names in different steps (e.g., step 1 uses "Speed" and "Quality" but step 3 uses "Scalability" and "Readability"), this is a major flaw — the challenge should reuse the same dimensions throughout.

5. FORMAT COMPLIANCE: Verify these constraints:
   - intro: Maximum 500 characters
   - steps: 4-6 steps, each with context (max 500 chars), question (max 100 chars), and 3-4 options
   - options: Each with text (max 80 chars), consequence (max 300 chars), effects array (1-3 items with dimension and impact)
   - reflection: Maximum 500 characters

6. PERSONALIZATION: The {{NAME}} placeholder must be used appropriately in intro and dialogue.

7. CONCEPTUAL ACCURACY: Consequences and effects must make sense given the lesson content. If the lesson teaches that X leads to Y, effects should reflect this.

8. DIALOGUE QUALITY: Context must be pure conversation with NO narrator text, NO character name prefixes, NO action descriptions.

9. REFLECTION QUALITY: The reflection must tie the experience back to lesson principles and acknowledge that different approaches have merit.

SEVERITY CALIBRATION (apply consistently):

Dimension count violations (the prompt requires 2-4 unique dimensions reused across ALL steps):
- 5 unique dimensions: moderate error (score 7.5-8.5). The challenge starts to lose recoverability.
- 6+ unique dimensions: major error (score 5-7). Recovery becomes impossible. The more dimensions, the harsher the penalty.
- Any dimension appearing in only 1 step: moderate error (score 7.5-8.5). Learners can't recover from bad choices on that dimension.

Dominant/dominated option violations (no option should be universally best or worst):
- 1 step with a dominant or dominated option: minor error (score 8.5-9).
- 2+ steps with dominant or dominated options: major error (score 6-8 depending on how many steps are affected).

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario choices or dimension names
- Do NOT require specific dimensions by name
- ONLY penalize for: format violations, exceeding the 2-4 dimension count limit, consequences that don't connect to lesson concepts, obviously dominant or dominated options, inconsistent dimension naming, narrator text in dialogue
- Different valid challenge designs exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Network data movement trade-offs must reflect genuine networking principles. Penalize if:
   - Encapsulation overhead effects are misrepresented in consequences
   - MTU and fragmentation trade-offs are incorrectly described

2. DIMENSION CHECK: Dimensions should represent meaningful networking concerns like:
   - Throughput, Latency, Reliability, Overhead
   - Should reflect the interconnected nature of data movement decisions

3. SCENARIO CHECK: The challenge should involve realistic network architecture or troubleshooting decisions.

4. CONSEQUENCE CHECK: Consequences should explain the real-world impact of data movement choices.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-data-movement",
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
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python numeric type trade-offs must reflect genuine programming concerns. Penalize if:
   - Float precision consequences are misrepresented
   - Bool-int relationship implications are incorrect

2. DIMENSION CHECK: Dimensions should represent meaningful programming concerns like:
   - Precision, Readability, Performance, Type Safety
   - Should reflect trade-offs in choosing numeric types

3. SCENARIO CHECK: The challenge should involve realistic Python development decisions about numeric types.

4. CONSEQUENCE CHECK: Consequences should explain how type choices affect code behavior and correctness.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
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

1. ACCURACY CHECK: Labor market policy trade-offs must reflect genuine economic principles. Penalize if:
   - Policy effects on unemployment vs participation are misrepresented
   - Timing of labor market adjustments is incorrect in consequences

2. DIMENSION CHECK: Dimensions should represent meaningful labor market concerns like:
   - Employment Level, Worker Welfare, Economic Output, Fiscal Cost
   - Should reflect the interconnected nature of labor market interventions

3. SCENARIO CHECK: The challenge should involve realistic labor market policy or management decisions during a downturn.

4. CONSEQUENCE CHECK: Consequences should explain how decisions affect labor market aggregates.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-cycles",
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
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Enolate chemistry trade-offs must reflect genuine organic chemistry principles. Penalize if:
   - Selectivity consequences are chemically incorrect
   - Base strength effects on enolate formation are misrepresented

2. DIMENSION CHECK: Dimensions should represent meaningful synthesis concerns like:
   - Selectivity, Yield, Reaction Speed, Side Products
   - Should reflect trade-offs in enolate chemistry conditions

3. SCENARIO CHECK: The challenge should involve realistic synthesis planning decisions involving enolate reactions.

4. CONSEQUENCE CHECK: Consequences should explain how reaction condition choices affect enolate selectivity and yield.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-acidez-enolatos",
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
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Connectivity debugging trade-offs must reflect genuine networking principles. Penalize if:
   - Debugging approach consequences are technically inaccurate
   - Layer isolation trade-offs are misrepresented

2. DIMENSION CHECK: Dimensions should represent meaningful debugging concerns like:
   - Diagnosis Speed, Thoroughness, Disruption Risk, Confidence
   - Should reflect trade-offs in different debugging approaches and strategies

3. SCENARIO CHECK: The challenge should involve realistic network troubleshooting decisions where different debugging strategies have different costs and benefits.

4. CONSEQUENCE CHECK: Consequences should explain how debugging approach choices affect time to resolution, accuracy of diagnosis, and impact on running systems.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-debugging-mental-models",
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
