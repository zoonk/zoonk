const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. INVENTORY DESIGN: Variables must connect meaningfully to lesson concepts. Each variable should represent something the learner studied. Names should be intuitive and values should start in a reasonable range (typically 40-70).

2. POSITIVE POLARITY: All variables must be named so that HIGHER = BETTER. Check that no variable uses negative-polarity naming where "more is worse":
   - BAD: Cost, Risk, Time, Debt, Errors, Stress, Waste
   - GOOD: Budget/Funds, Safety/Security, Speed/Efficiency, Financial Health, Code Quality, Team Morale, Resource Efficiency
   The simple test: "Is more of this good?" If no, the variable name is wrong.

3. TRADE-OFF QUALITY: Every option must have genuine trade-offs. No option should be obviously dominant across all variables. Improving one variable should plausibly affect others based on lesson principles.

4. WIN CONDITION BALANCE: Win conditions must be achievable with strategic thinking but require understanding lesson concepts. Conditions should create strategic tension (meeting all should require careful planning). Each inventory item must have its own win conditions embedded.

5. FORMAT COMPLIANCE: Verify these constraints:
   - intro: Maximum 500 characters
   - inventory: 3-5 items, each with name, startValue, and winConditions array (1-2 conditions per item)
   - winConditions (per item): Array with operator (gte/lte/gt/lt/eq) and value
   - steps: 3-6 steps, each with context (max 500 chars), question (max 100 chars), and 3-4 options
   - options: Each with text (max 80 chars), effects array, and feedback (max 300 chars)

6. FEEDBACK QUALITY: Each option's feedback must explain WHY the effects occur, connecting to lesson concepts. Feedback should help learners understand the reasoning behind trade-offs.

7. PERSONALIZATION: The {{NAME}} placeholder must be used appropriately in intro and dialogue to personalize the experience.

8. CONCEPTUAL ACCURACY: Effects must make sense given the lesson content. If the lesson teaches that X leads to Y, the effects should reflect this relationship.

9. DIALOGUE QUALITY: Context must be pure conversation with NO narrator text, NO character name prefixes, NO action descriptions. Should feel like colleagues working through a problem.

10. EFFECT DESIGN: Effects should use realistic magnitudes (typically 5-20 points). Dramatic swings (30+) should be rare and justified.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario choices or variable names (as long as they follow positive polarity)
- Do NOT require specific inventory variables by name
- ONLY penalize for: format violations, negative-polarity variable names, dominant options with no trade-offs, effects that contradict lesson concepts, narrator/description text in dialogue, or unachievable win conditions
- Different valid challenge designs exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Algorithm complexity trade-offs must reflect genuine CS principles. Penalize if:
   - Time vs. space trade-offs are misrepresented
   - Big-O implications are incorrect
   - Memory vs. speed decisions don't reflect real algorithmic trade-offs

2. INVENTORY CHECK: Variables should represent meaningful algorithmic metrics like:
   - Execution time, memory usage, code maintainability
   - Should NOT include unrelated variables like "team morale" for this topic

3. SCENARIO CHECK: The challenge should involve realistic algorithm selection decisions like: choosing between sorting algorithms, data structure selection, or optimization strategies.

4. TRADE-OFF CHECK: Options should reflect genuine algorithmic trade-offs — faster algorithms using more memory, simpler code being less efficient, etc.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-algorithm-complexity",
    userInput: {
      chapterTitle: "Algorithm Analysis",
      courseTitle: "Data Structures and Algorithms",
      explanationSteps: [
        {
          text: "Time complexity measures how execution time grows with input size. O(n) means linear growth — double the input, double the time. O(n²) means quadratic — double the input, quadruple the time.",
          title: "Time Complexity",
        },
        {
          text: "Space complexity measures memory usage growth. Some algorithms trade time for space — storing precomputed results to avoid recalculation. Others trade space for time — using less memory but computing more.",
          title: "Space Complexity",
        },
        {
          text: "The time-space trade-off is fundamental. Hash tables give O(1) lookup but use extra memory. Binary search uses O(1) space but requires sorted data. Choose based on constraints.",
          title: "Time-Space Trade-off",
        },
        {
          text: "Amortized analysis looks at average performance over many operations. ArrayList append is usually O(1), but occasionally O(n) when resizing. Amortized, it's still O(1).",
          title: "Amortized Analysis",
        },
        {
          text: "Best, average, and worst case can differ dramatically. Quicksort averages O(n log n) but worst-cases to O(n²). Know your data distribution to choose wisely.",
          title: "Case Analysis",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding and applying algorithm complexity analysis to make informed trade-offs in software design",
      lessonTitle: "Algorithm Complexity Trade-offs",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Supply and demand concepts must reflect genuine economics. Penalize if:
   - Price elasticity effects are misrepresented
   - Supply/demand curve shifts are incorrectly described
   - Market equilibrium concepts are misapplied

2. INVENTORY CHECK: Variables should represent meaningful market metrics like:
   - Revenue, market share, customer satisfaction, inventory levels
   - Should reflect the interconnected nature of market decisions

3. SCENARIO CHECK: The challenge should involve realistic pricing and market decisions like: setting prices, responding to competitor moves, or managing supply/demand imbalances.

4. TRADE-OFF CHECK: Options should reflect genuine market trade-offs — higher prices reducing volume, lower prices affecting margins, etc.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-supply-demand",
    userInput: {
      chapterTitle: "Market Dynamics",
      courseTitle: "Microeconomics Fundamentals",
      explanationSteps: [
        {
          text: "Demand curves slope downward — as price rises, quantity demanded falls. This reflects the law of demand: people buy less when things cost more, all else equal.",
          title: "The Demand Curve",
        },
        {
          text: "Supply curves slope upward — as price rises, quantity supplied increases. Higher prices incentivize producers to make more. Lower prices make production less worthwhile.",
          title: "The Supply Curve",
        },
        {
          text: "Equilibrium occurs where supply meets demand. At this price, quantity supplied equals quantity demanded. Prices above equilibrium create surplus; prices below create shortage.",
          title: "Market Equilibrium",
        },
        {
          text: "Price elasticity measures responsiveness to price changes. Elastic demand (>1) means sales drop sharply with price increases. Inelastic demand (<1) means sales barely change.",
          title: "Price Elasticity",
        },
        {
          text: "Shifts vs. movements: A change in price moves along the curve. Changes in other factors (income, preferences, costs) shift the entire curve. This distinction is crucial.",
          title: "Shifts vs. Movements",
        },
      ],
      language: "en",
      lessonDescription:
        "Applying supply and demand principles to make strategic pricing and market decisions",
      lessonTitle: "Supply and Demand in Practice",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Ecosystem concepts must reflect genuine ecology. Penalize if:
   - Trophic level interactions are misrepresented
   - Carrying capacity concepts are incorrectly applied
   - Biodiversity-stability relationships are oversimplified

2. INVENTORY CHECK: Variables should represent meaningful ecological metrics like:
   - Species diversity, population health, resource availability, ecosystem stability
   - Should reflect the interconnected nature of ecosystems

3. SCENARIO CHECK: The challenge should involve realistic ecosystem management decisions like: conservation priorities, resource allocation, or balancing competing ecological needs.

4. TRADE-OFF CHECK: Options should reflect genuine ecological trade-offs — protecting one species affecting another, short-term vs. long-term sustainability, etc.

${SHARED_EXPECTATIONS}
    `,
    id: "en-biology-ecosystem-balance",
    userInput: {
      chapterTitle: "Ecosystem Dynamics",
      courseTitle: "Ecology and Conservation",
      explanationSteps: [
        {
          text: "Ecosystems are interconnected networks. Removing one species affects others through food webs. Keystone species have disproportionate impact — their loss cascades through the system.",
          title: "Interconnected Networks",
        },
        {
          text: "Carrying capacity is the maximum population an environment can sustain. Exceed it, and resources deplete, populations crash. Stay well below, and you're not maximizing the ecosystem's potential.",
          title: "Carrying Capacity",
        },
        {
          text: "Biodiversity provides resilience. More species means more ways to respond to change. Monocultures are efficient but fragile. Diverse systems are robust but complex to manage.",
          title: "Biodiversity and Resilience",
        },
        {
          text: "Trophic cascades occur when changes at one level ripple through others. Remove predators, and prey populations explode, overgrazing vegetation, affecting everything that depends on those plants.",
          title: "Trophic Cascades",
        },
        {
          text: "Ecological succession is the process of change over time. Pioneer species prepare the way for later ones. Managing ecosystems means deciding where in succession you want to be.",
          title: "Ecological Succession",
        },
      ],
      language: "en",
      lessonDescription:
        "Applying ecological principles to make informed ecosystem management decisions",
      lessonTitle: "Ecosystem Balance and Management",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Le Chatelier's principle must be correctly applied. Penalize if:
   - Equilibrium shift directions are incorrect
   - Temperature, pressure, concentration effects are misrepresented
   - The principle is applied to situations where it doesn't hold

2. INVENTORY CHECK: Variables should represent meaningful chemical process metrics like:
   - Product yield, reaction rate, energy costs, raw material usage
   - Should reflect how equilibrium adjustments affect industrial processes

3. SCENARIO CHECK: The challenge should involve realistic chemical process decisions like: optimizing reaction conditions, balancing yield vs. cost, or managing industrial synthesis.

4. TRADE-OFF CHECK: Options should reflect genuine chemical trade-offs — higher temperature increasing rate but shifting equilibrium, pressure effects on yield vs. equipment costs, etc.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-chemistry-reaction-equilibrium",
    userInput: {
      chapterTitle: "Equilibrio Quimico",
      courseTitle: "Quimica Geral II",
      explanationSteps: [
        {
          text: "O principio de Le Chatelier diz que um sistema em equilibrio responde a perturbacoes minimizando a mudanca. Adicione reagente, o equilibrio desloca para consumir esse reagente.",
          title: "Principio de Le Chatelier",
        },
        {
          text: "Mudancas de concentracao deslocam o equilibrio. Adicionar reagentes desloca para produtos. Remover produtos tambem desloca para produtos. O sistema busca restaurar o equilibrio.",
          title: "Efeito da Concentracao",
        },
        {
          text: "A pressao afeta equilibrios gasosos. Aumentar pressao favorece o lado com menos moles de gas. Diminuir pressao favorece o lado com mais moles. Gases inertes nao afetam.",
          title: "Efeito da Pressao",
        },
        {
          text: "Temperatura e diferente — ela muda a constante de equilibrio. Reacoes exotermicas: aumento de temperatura desloca para reagentes. Reacoes endotermicas: aumento favorece produtos.",
          title: "Efeito da Temperatura",
        },
        {
          text: "Catalisadores aceleram ambas as direcoes igualmente. Eles nao deslocam o equilibrio — apenas ajudam a alcancar o equilibrio mais rapido. Util para processos industriais.",
          title: "Papel dos Catalisadores",
        },
      ],
      language: "pt",
      lessonDescription:
        "Aplicando o principio de Le Chatelier para otimizar reacoes quimicas e processos industriais",
      lessonTitle: "Equilibrio Quimico na Pratica",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Energy conservation principles must be physically accurate. Penalize if:
   - Energy transformations violate conservation laws
   - Efficiency concepts are misrepresented
   - Entropy/waste heat considerations are ignored

2. INVENTORY CHECK: Variables should represent meaningful energy system metrics like:
   - Energy output, efficiency rating, environmental impact, operating costs
   - Should reflect the interconnected nature of energy systems

3. SCENARIO CHECK: The challenge should involve realistic energy system decisions like: choosing energy sources, optimizing efficiency, or balancing output vs. sustainability.

4. TRADE-OFF CHECK: Options should reflect genuine energy trade-offs — higher output vs. efficiency losses, renewable vs. reliability, cost vs. environmental impact, etc.

${SHARED_EXPECTATIONS}
    `,
    id: "es-physics-energy-conservation",
    userInput: {
      chapterTitle: "Energia y Trabajo",
      courseTitle: "Fisica Aplicada",
      explanationSteps: [
        {
          text: "La energia no se crea ni se destruye, solo se transforma. En cada conversion, la energia total se conserva, pero la energia util disminuye. Parte siempre se convierte en calor no aprovechable.",
          title: "Conservacion de la Energia",
        },
        {
          text: "La eficiencia mide cuanta energia de entrada se convierte en trabajo util. Ningun proceso es 100% eficiente — siempre hay perdidas. La segunda ley de la termodinamica lo garantiza.",
          title: "Eficiencia Energetica",
        },
        {
          text: "Las cadenas de conversion acumulan perdidas. Si cada paso es 90% eficiente, tres pasos dan 0.9³ = 73% eficiencia total. Menos conversiones significa menos perdidas.",
          title: "Perdidas en Cadena",
        },
        {
          text: "El almacenamiento de energia tiene su propio costo energetico. Cargar y descargar baterias pierde energia. Bombear agua cuesta arriba para hidroelectrica tambien. El almacenamiento no es gratis.",
          title: "Costo del Almacenamiento",
        },
        {
          text: "La densidad energetica importa. Combustibles fosiles almacenan mucha energia por kilogramo. Las baterias almacenan menos. Esto afecta que es practico para cada aplicacion.",
          title: "Densidad Energetica",
        },
      ],
      language: "es",
      lessonDescription:
        "Aplicando principios de conservacion de energia para disenar y optimizar sistemas energeticos",
      lessonTitle: "Conservacion de Energia en Sistemas Reales",
    },
  },
];
