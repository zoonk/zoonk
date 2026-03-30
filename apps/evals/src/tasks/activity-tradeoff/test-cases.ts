const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. SCENARIO QUALITY: The scenario must be relatable and use {{NAME}} for personalization. Introductory topics should use everyday scenarios (studying, budgeting, health). Advanced topics should use professional/workplace scenarios. Penalize:
   - Scenarios that feel like a pedagogical setup rather than a real dilemma
   - Scenarios too abstract or disconnected from the learner's life
   - Missing {{NAME}} placeholder

2. PRIORITY CONFLICT: Priorities must genuinely conflict — investing in one should make neglecting another WORSE, not just leave it unchanged. Penalize:
   - Independent priorities where neglecting one has no effect on others
   - Priorities that are all clearly positive (no tension)
   - Priorities that are obviously ranked (one is clearly "best")

3. TRAP PRIORITY: At least one priority should sound urgent or important but heavy investment has diminishing returns — 1 token of maintenance is enough. Penalize:
   - All priorities equally benefiting from heavy investment
   - No priority where the learner's instinct is suboptimal

4. THREE-TIER DIVERSITY: The "maintained" outcome must feel meaningfully different from both "invested" and "neglected" — not just a medium version. Penalize:
   - Maintained outcomes that are just softer versions of neglected
   - Maintained outcomes that are just weaker versions of invested
   - All three tiers telling essentially the same story with different severity

5. CONSEQUENCE QUALITY: Round 1 consequences should be one short, visceral sentence. Later round consequences can be 1-2 sentences. Consequences should naturally reference lesson concepts as they play out. Penalize:
   - Round 1 consequences that are too long or academic
   - Consequences that read like textbook paragraphs
   - Consequences that don't connect to the lesson's concepts
   - Generic consequences that could apply to any topic

6. EVENT DRAMA: Round 2+ events must change the strategic landscape — not just add narrative flavor. They should include tokenOverride (fewer resources) or stateModifiers (priority shifts), or ideally both. Penalize:
   - Events that are purely narrative with null tokenOverride AND null stateModifiers
   - Events that don't change the learner's calculus
   - Events that feel like filler between rounds

7. TOKEN TIGHTENING: Resources should generally decrease or demands increase across rounds, forcing harder choices. Penalize:
   - Same token count every round with no strategic shift
   - Resources increasing without justification

8. REFLECTION: Must surface the underlying principle from the lesson concepts, not just summarize the scenario. Should explain WHY different strategies lead to different outcomes. Penalize:
   - Reflections that only describe what happened
   - Reflections disconnected from the lesson's concepts
   - Vague platitudes ("balance is important")

STRUCTURAL CHECKS:
- 3-4 priorities with unique camelCase IDs
- 4-6 base tokens
- 2-4 rounds (AI chooses based on complexity)
- Round 1 event must be null
- Every round must have one outcome per priority
- Priority IDs in outcomes must match the priorities array
- Character limits: scenario ≤200, priority name ≤40, description ≤100, event ≤300, consequence ≤200, reflection ≤500

ANTI-CHECKLIST GUIDANCE:
- Do NOT penalize for choosing 2 rounds for a simple topic or 4 for a complex one
- Do NOT require a specific token progression pattern — decreasing is common but not mandatory
- Do NOT expect consequences to teach the lesson didactically — they should show concepts in action
- ONLY penalize for: weak priority conflict, missing trap priority, flat three-tier outcomes, narrative-only events, disconnected reflection, or structural violations
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC: Introductory neuroscience — how the brain learns and remembers.

SCENARIO GUIDANCE:
- Should be an everyday scenario (e.g., preparing for an exam, managing study habits)
- Priorities should relate to brain functions: study, sleep/rest, exercise, social connection
- The "trap" should be pure study — neuroscience shows sleep and exercise are critical for memory consolidation

CONCEPT APPLICATION:
- Consequences should reference: memory consolidation during sleep, BDNF from exercise, cortisol effects on hippocampus, forgetting curve
- The reflection should connect to how learning happens in stages (encoding, consolidation, retrieval)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-neuroscience-intro",
    userInput: {
      chapterTitle: "O cérebro e a aprendizagem",
      courseTitle: "Introdução à Neurociência",
      explanationSteps: [
        {
          text: "A neurociência é o estudo do sistema nervoso e do cérebro. Ela nos ajuda a entender como aprendemos, memorizamos e tomamos decisões.",
          title: "O que é Neurociência",
        },
        {
          text: "O cérebro forma novas conexões entre neurônios quando aprendemos algo novo. Esse processo é chamado de neuroplasticidade e é fortalecido por repetição, sono e exercício físico.",
          title: "Neuroplasticidade",
        },
        {
          text: "O hipocampo é a região do cérebro responsável por consolidar memórias de curto prazo em memórias de longo prazo. Esse processo acontece principalmente durante o sono profundo.",
          title: "Consolidação de Memórias",
        },
      ],
      language: "pt",
      lessonDescription:
        "Conceitos fundamentais de neurociência: o que é, como o cérebro aprende e como as memórias se formam.",
      lessonTitle: "O que é Neurociência",
    },
  },
  {
    expectations: `
TOPIC: Advanced software engineering — managing technical debt and delivery tradeoffs.

SCENARIO GUIDANCE:
- Should be a workplace/startup scenario (e.g., startup post-Series A, engineering team lead)
- Priorities should relate to: code quality/refactoring, feature delivery, team morale/developer experience, system reliability
- The "trap" could be feature delivery — shipping fast without tests creates compounding debt

CONCEPT APPLICATION:
- Consequences should reference: technical debt compounding, refactoring ROI, developer burnout, reliability SLAs
- Events should include realistic disruptions: key person leaving, urgent client demand, production incident

${SHARED_EXPECTATIONS}
    `,
    id: "en-software-engineering",
    userInput: {
      chapterTitle: "Engineering Leadership",
      courseTitle: "Software Engineering Management",
      explanationSteps: [
        {
          text: "Technical debt is the accumulated cost of shortcuts taken during development. Like financial debt, it compounds — each shortcut makes future changes harder and more error-prone.",
          title: "Technical Debt",
        },
        {
          text: "Refactoring improves code structure without changing behavior. The ROI of refactoring is measured in reduced future development time, fewer bugs, and easier onboarding for new team members.",
          title: "Refactoring ROI",
        },
        {
          text: "Developer experience (DX) directly impacts productivity and retention. Teams with good tooling, clear documentation, and manageable workloads ship more reliably than teams that optimize only for speed.",
          title: "Developer Experience",
        },
      ],
      language: "en",
      lessonDescription:
        "How to balance technical debt, delivery speed, and team health in a growing engineering organization.",
      lessonTitle: "Managing Technical Debt",
    },
  },
  {
    expectations: `
TOPIC: Personal finance basics — budgeting and saving tradeoffs.

SCENARIO GUIDANCE:
- Should be an everyday scenario (e.g., first job, managing monthly budget)
- Priorities should relate to: saving/emergency fund, daily expenses/lifestyle, education/skills, debt repayment
- The "trap" could be lifestyle spending — feels necessary but has the least long-term impact

LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-personal-finance",
    userInput: {
      chapterTitle: "Fundamentos de finanzas",
      courseTitle: "Finanzas Personales",
      explanationSteps: [
        {
          text: "Un presupuesto es un plan para distribuir tus ingresos entre necesidades, deseos y ahorro. La regla 50/30/20 sugiere: 50% necesidades, 30% deseos, 20% ahorro.",
          title: "Qué es un presupuesto",
        },
        {
          text: "Un fondo de emergencia cubre 3-6 meses de gastos esenciales. Sin él, cualquier imprevisto puede convertirse en deuda — es la base de la estabilidad financiera.",
          title: "Fondo de emergencia",
        },
        {
          text: "El interés compuesto hace que las deudas crezcan exponencialmente si solo pagas el mínimo. Priorizar el pago de deudas de alto interés ahorra más a largo plazo.",
          title: "Interés compuesto y deudas",
        },
      ],
      language: "es",
      lessonDescription:
        "Conceptos básicos de presupuesto, ahorro y manejo de deudas para tomar mejores decisiones financieras.",
      lessonTitle: "Presupuesto y Ahorro",
    },
  },
  {
    expectations: `
TOPIC: Climate science — environmental policy tradeoffs.

SCENARIO GUIDANCE:
- Should be a moderate-complexity scenario (e.g., city council member, company sustainability officer)
- Priorities should relate to: emissions reduction, economic growth, public support, infrastructure investment
- The "trap" could be public support — sounds politically necessary but doesn't directly reduce emissions

CONCEPT APPLICATION:
- Consequences should reference: carbon budget, tipping points, green infrastructure ROI, stranded assets
- This is a complex topic — expect 3-4 rounds

${SHARED_EXPECTATIONS}
    `,
    id: "en-climate-policy",
    userInput: {
      chapterTitle: "Climate Action",
      courseTitle: "Environmental Science",
      explanationSteps: [
        {
          text: "The carbon budget is the maximum amount of CO2 that can be emitted while keeping warming below a target. Once the budget is spent, every additional ton of emissions increases the risk of irreversible tipping points.",
          title: "Carbon Budget",
        },
        {
          text: "Green infrastructure (renewable energy, public transit, building retrofits) requires high upfront investment but pays off through reduced operating costs and avoided climate damages over decades.",
          title: "Green Infrastructure",
        },
        {
          text: "Stranded assets are investments that lose value due to climate policy changes. Fossil fuel infrastructure built today may become worthless as regulations tighten, creating economic risk alongside environmental risk.",
          title: "Stranded Assets",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding the tradeoffs between economic growth, emissions reduction, and long-term sustainability in climate policy.",
      lessonTitle: "Climate Policy Tradeoffs",
    },
  },
  {
    expectations: `
TOPIC: Time management basics — productivity tradeoffs.

SCENARIO GUIDANCE:
- Should be an everyday scenario (e.g., university student, freelancer managing clients)
- Priorities should relate to: deep work/focus, quick tasks/email, breaks/rest, planning/organization
- The "trap" could be quick tasks — feels productive but consumes time without meaningful progress

LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-time-management",
    userInput: {
      chapterTitle: "Produtividade pessoal",
      courseTitle: "Gestão do Tempo",
      explanationSteps: [
        {
          text: "Trabalho profundo (deep work) é a capacidade de se concentrar sem distrações em uma tarefa cognitivamente exigente. É nesse estado que produzimos nosso trabalho mais valioso.",
          title: "Trabalho Profundo",
        },
        {
          text: "A troca de contexto (alternar entre tarefas) tem um custo cognitivo real — cada vez que você muda de tarefa, leva em média 23 minutos para retomar a concentração total.",
          title: "Custo da troca de contexto",
        },
        {
          text: "A Lei de Parkinson diz que o trabalho se expande para preencher o tempo disponível. Sem prazos claros e planejamento, tarefas simples podem consumir horas desnecessárias.",
          title: "Lei de Parkinson",
        },
      ],
      language: "pt",
      lessonDescription:
        "Como organizar seu tempo para maximizar produtividade sem sacrificar bem-estar.",
      lessonTitle: "Gestão do Tempo",
    },
  },
];
