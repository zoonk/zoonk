const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. REAL-WORLD RELEVANCE: Examples must be concrete, recognizable situations from everyday life. Penalize abstract or theoretical applications without clear real-world grounding.

2. CONTEXT DIVERSITY: Content should show the topic across different life domains (daily life, work, entertainment, unexpected places, personal interests). Variety helps different learners connect.

3. RECOGNITION FACTOR: Examples should create "aha moments" — helping learners see the topic in familiar places they hadn't noticed before.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like pointing out hidden patterns in everyday life. Include metaphors and analogies from familiar activities.

6. FOCUS: Shows WHERE something appears (real-world contexts), not WHAT it is (definitions) or HOW it works (processes).

7. NO OVERLAP: Must not repeat content from the EXPLANATION_STEPS which covered the WHAT.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing specific life domains or contexts you might expect
- Do NOT require a specific number of contexts or examples
- Do NOT check against an imagined "complete" list of applications
- Do NOT penalize for JSON structure or output format (e.g., wrapping in an object vs returning a raw array). The output uses a structured schema — evaluate ONLY the content quality of titles and text, not how the data is structured
- ONLY penalize for: incorrect real-world claims, abstract examples without concrete situations, overlap with explanation content, or lack of variety in context types
- Different valid sets of examples exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Probability examples must reflect genuine statistical reasoning. Penalize if:
   - Examples confuse probability with certainty (e.g., "you will definitely win" vs. "you have a 50% chance")
   - Real-world probability claims are mathematically implausible for the context

2. CONTEXT CHECK: Penalize if examples are limited to gambling/games. Probability appears in medicine, weather, insurance, dating, sports, business decisions, and daily risk assessment.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT probability is (ratios, likelihood, sample spaces). This should show WHERE probability thinking appears in familiar life situations.

${SHARED_EXPECTATIONS}
    `,
    id: "en-math-probability-basics",
    userInput: {
      chapterTitle: "Introduction to Statistics",
      courseTitle: "Mathematics for Life",
      explanationSteps: [
        {
          text: "Probability measures how likely something is to happen, expressed as a number between 0 and 1. Zero means impossible, one means certain, and values in between show varying degrees of likelihood.",
          title: "What Is Probability?",
        },
        {
          text: "The sample space is the set of all possible outcomes. For a coin flip, it's heads or tails. For a die roll, it's 1 through 6. Knowing the sample space is the first step in calculating probabilities.",
          title: "Sample Space",
        },
        {
          text: "To find the probability of an event, divide favorable outcomes by total possible outcomes. If 2 out of 6 die faces are even, the probability of rolling an even number is 2/6 or about 33%.",
          title: "Calculating Probability",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how probability thinking helps us make better decisions in uncertain situations",
      lessonTitle: "Probability in Everyday Life",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Supply and demand examples must reflect genuine economic dynamics. Penalize if:
   - Price changes are attributed to single-cause explanations when multiple factors interact
   - Examples suggest prices are arbitrarily set rather than emerging from market forces

2. CONTEXT CHECK: Penalize only if ALL examples are simple store-purchase scenarios (e.g., "buy X at the store" repeatedly). Diverse market contexts — such as housing, rideshare surge pricing, concert tickets, seasonal goods, or gig economy — count as variety even though they involve transactions. Supply and demand inherently involves markets, so the bar is whether examples show different TYPES of market forces, not whether they go beyond transactions entirely.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT supply and demand curves are. This should show WHERE these forces visibly shape real-world situations.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-supply-demand",
    userInput: {
      chapterTitle: "Market Fundamentals",
      courseTitle: "Economics 101",
      explanationSteps: [
        {
          text: "Supply represents how much producers are willing to sell at different prices. Higher prices encourage more production because potential profits increase.",
          title: "The Supply Side",
        },
        {
          text: "Demand represents how much consumers want to buy at different prices. Lower prices attract more buyers because products become more affordable.",
          title: "The Demand Side",
        },
        {
          text: "Market equilibrium occurs where supply and demand curves intersect. At this price, sellers sell exactly what buyers want to buy — no shortages, no surpluses.",
          title: "Finding Equilibrium",
        },
      ],
      language: "en",
      lessonDescription:
        "Recognizing how supply and demand forces shape prices and availability in markets all around us",
      lessonTitle: "Supply and Demand in Action",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Recursion examples must genuinely involve self-reference or self-similarity. Penalize if:
   - Examples describe simple repetition or loops instead of true recursion
   - The base case concept is missing from examples that claim to show recursion

2. CONTEXT CHECK: Penalize if examples are limited to coding. Recursion appears in nature (fractals, tree branches), art (Droste effect, mise en abyme), language (nested sentences), organizations (hierarchies), and problem-solving.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT recursion is (functions calling themselves). This should show WHERE recursive patterns appear in nature, art, and daily life.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-recursion-concept",
    userInput: {
      chapterTitle: "Problem-Solving Patterns",
      courseTitle: "Computer Science Fundamentals",
      explanationSteps: [
        {
          text: "Recursion is when something is defined in terms of itself. A function calling itself, a definition referencing itself, or a structure containing smaller versions of itself.",
          title: "Self-Reference",
        },
        {
          text: "Every recursion needs a base case — the simplest version that doesn't recurse further. Without it, the recursion would continue forever.",
          title: "The Base Case",
        },
        {
          text: "Recursive solutions break big problems into smaller identical problems. Solve the small ones, combine the results, and the big problem solves itself.",
          title: "Divide and Conquer",
        },
      ],
      language: "en",
      lessonDescription:
        "Discovering recursive patterns in programming, nature, art, and everyday problem-solving",
      lessonTitle: "Recursion: The Pattern Within",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Cognitive bias examples must reflect genuine psychological phenomena. Penalize if:
   - Examples describe rational behavior and mislabel it as bias
   - Specific biases are incorrectly named or conflated with each other

2. CONTEXT CHECK: Penalize if examples are limited to business/marketing. Cognitive biases affect relationships, health decisions, politics, self-perception, memory, and everyday judgments.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT cognitive biases are (systematic thinking errors). This should show WHERE these biases quietly influence decisions we make daily.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-psychology-cognitive-biases",
    userInput: {
      chapterTitle: "Tomada de Decisao",
      courseTitle: "Psicologia Aplicada",
      explanationSteps: [
        {
          text: "Vieses cognitivos sao erros sistematicos no pensamento que afetam nossas decisoes. Nao sao estupidez — sao atalhos mentais que funcionam na maioria das vezes, mas falham em certas situacoes.",
          title: "O Que Sao Vieses",
        },
        {
          text: "Heuristicas sao regras praticas que nosso cerebro usa para decidir rapidamente. Elas economizam energia mental, mas podem nos levar a conclusoes erradas quando aplicadas no contexto errado.",
          title: "Atalhos Mentais",
        },
        {
          text: "O vies de confirmacao nos faz buscar informacoes que confirmam o que ja acreditamos. Ignoramos evidencias contrarias e supervalorizamos as que apoiam nossa visao.",
          title: "Vies de Confirmacao",
        },
      ],
      language: "pt",
      lessonDescription:
        "Reconhecendo como vieses cognitivos afetam nossas decisoes em compras, relacionamentos, politica e vida cotidiana",
      lessonTitle: "Vieses no Dia a Dia",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Natural selection examples must reflect genuine evolutionary dynamics. Penalize if:
   - Examples suggest intentional evolution or "design" (natural selection is blind)
   - Lamarckian inheritance is implied (giraffes stretching their necks doesn't change genes)

2. CONTEXT CHECK: Penalize if examples are limited to textbook animals. Natural selection is visible in antibiotic resistance, pesticide resistance, dog breeds, crop development, and even cultural evolution.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT natural selection is (differential survival and reproduction). This should show WHERE we can observe selection in action today.

${SHARED_EXPECTATIONS}
    `,
    id: "es-biology-natural-selection",
    userInput: {
      chapterTitle: "Evolucion",
      courseTitle: "Biologia General",
      explanationSteps: [
        {
          text: "La seleccion natural ocurre cuando individuos con ciertos rasgos sobreviven y se reproducen mas que otros. Estos rasgos se vuelven mas comunes en generaciones futuras.",
          title: "Supervivencia Diferencial",
        },
        {
          text: "La variacion es esencial — sin diferencias entre individuos, no hay nada que seleccionar. Las mutaciones y la reproduccion sexual generan esta variacion.",
          title: "Variacion Genetica",
        },
        {
          text: "La aptitud biologica mide el exito reproductivo, no la fuerza fisica. Un organismo 'apto' es el que deja mas descendientes viables, no necesariamente el mas fuerte.",
          title: "Aptitud Biologica",
        },
      ],
      language: "es",
      lessonDescription:
        "Observando como la seleccion natural moldea la vida a nuestro alrededor, desde bacterias hasta mascotas",
      lessonTitle: "Seleccion Natural en Accion",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Machine learning examples must reflect genuine ML applications. Penalize if:
   - Examples describe simple rule-based systems as ML (if-then rules aren't learning)
   - Claims about ML capabilities are exaggerated beyond current technology

2. CONTEXT CHECK: Penalize if examples are limited to tech companies. ML appears in medicine, agriculture, music recommendations, email filters, translation, photo organization, and fraud detection.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT machine learning is (learning from data vs explicit programming). This should show WHERE ML quietly powers everyday tools and services.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-machine-learning-intro",
    userInput: {
      chapterTitle: "Artificial Intelligence Basics",
      courseTitle: "Technology in Modern Life",
      explanationSteps: [
        {
          text: "Machine learning is when computers learn from examples rather than following explicit rules. Show a system thousands of cat photos, and it learns to recognize cats without being told what a cat looks like.",
          title: "Learning from Data",
        },
        {
          text: "Training data is the set of examples the system learns from. The quality and quantity of training data largely determines how well the model performs.",
          title: "Training Data",
        },
        {
          text: "Models are mathematical patterns extracted from data. Once trained, they can make predictions on new data they haven't seen before — that's the real power of ML.",
          title: "Models and Predictions",
        },
      ],
      language: "en",
      lessonDescription:
        "Discovering where machine learning already works in apps, devices, and services you use daily",
      lessonTitle: "Machine Learning All Around You",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Compound interest examples must reflect accurate financial math. Penalize if:
   - Examples confuse simple and compound interest
   - Time horizons or rates produce mathematically implausible results

2. CONTEXT CHECK: Penalize if examples are limited to savings accounts. Compound interest/growth appears in debt, population, viral spread, skill development, relationship investment, and content creation.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT compound interest is (earning interest on interest). This should show WHERE compounding effects shape finances, growth, and life outcomes.

${SHARED_EXPECTATIONS}
    `,
    id: "en-finance-compound-interest",
    userInput: {
      chapterTitle: "Building Wealth",
      courseTitle: "Personal Finance",
      explanationSteps: [
        {
          text: "Compound interest is earning interest on your interest. Unlike simple interest that only grows the original amount, compound interest grows the total including previous interest earned.",
          title: "Interest on Interest",
        },
        {
          text: "The compounding period determines how often interest is calculated. Monthly compounding adds interest 12 times per year; daily compounding adds it 365 times. More frequent = faster growth.",
          title: "Compounding Frequency",
        },
        {
          text: "The Rule of 72 estimates doubling time: divide 72 by the interest rate. At 8% annual return, money doubles roughly every 9 years. This quick mental math reveals compounding's power.",
          title: "The Rule of 72",
        },
      ],
      language: "en",
      lessonDescription:
        "Recognizing how compound growth shapes wealth building, debt accumulation, and many other life phenomena",
      lessonTitle: "The Power of Compounding",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Photosynthesis application examples must be scientifically accurate. Penalize if:
   - Examples overstate or understate photosynthesis's role in specific contexts
   - Carbon cycle connections are incorrectly described

2. CONTEXT CHECK: Penalize if examples are limited to forests/plants. Photosynthesis impacts food supply, oxygen production, fossil fuel origins, aquatic ecosystems, agriculture, and climate solutions.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT photosynthesis is (converting light to chemical energy). This should show WHERE photosynthesis affects human life and global systems.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biology-photosynthesis-importance",
    userInput: {
      chapterTitle: "Energia nos Seres Vivos",
      courseTitle: "Biologia Celular",
      explanationSteps: [
        {
          text: "A fotossintese converte luz solar em energia quimica. Plantas capturam fotons e usam essa energia para transformar agua e CO2 em glicose — o combustivel da vida.",
          title: "Captura de Luz",
        },
        {
          text: "A clorofila e o pigmento que absorve luz. Ela captura principalmente luz vermelha e azul, refletindo verde — por isso as plantas tem essa cor.",
          title: "O Papel da Clorofila",
        },
        {
          text: "O oxigenio que respiramos e um subproduto da fotossintese. Quando plantas quebram agua para obter hidrogenio, liberam O2 como residuo.",
          title: "Origem do Oxigenio",
        },
      ],
      language: "pt",
      lessonDescription:
        "Descobrindo como a fotossintese sustenta a vida na Terra e afeta nosso ar, comida e clima",
      lessonTitle: "Fotossintese e a Vida na Terra",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Encryption examples must reflect genuine security applications. Penalize if:
   - Examples confuse encryption with other security measures (passwords, firewalls)
   - Claims about encryption strength or applications are technically inaccurate

2. CONTEXT CHECK: Penalize if examples are limited to banking. Encryption protects messaging, medical records, voting systems, e-commerce, streaming services, and even car key fobs.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT encryption is (scrambling data with keys). This should show WHERE encryption silently protects information in daily digital life.

${SHARED_EXPECTATIONS}
    `,
    id: "es-cs-encryption-applications",
    userInput: {
      chapterTitle: "Seguridad Digital",
      courseTitle: "Tecnologia para Todos",
      explanationSteps: [
        {
          text: "La encriptacion transforma datos legibles en codigo ilegible. Solo quien tiene la clave correcta puede revertir el proceso y leer el contenido original.",
          title: "Datos Codificados",
        },
        {
          text: "Las claves son como llaves digitales. La encriptacion simetrica usa una clave compartida; la asimetrica usa un par de claves — una publica y una privada.",
          title: "Claves de Encriptacion",
        },
        {
          text: "HTTPS en sitios web significa que la conexion esta encriptada. El candado en tu navegador indica que los datos viajan protegidos entre tu dispositivo y el servidor.",
          title: "HTTPS y Conexiones Seguras",
        },
      ],
      language: "es",
      lessonDescription:
        "Descubriendo donde la encriptacion protege silenciosamente tu informacion en aplicaciones, sitios y dispositivos cotidianos",
      lessonTitle: "Encriptacion en Tu Vida Digital",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Feedback loop examples must genuinely involve circular causation. Penalize if:
   - Examples describe simple cause-effect chains without feedback
   - Positive and negative feedback are conflated or mislabeled

2. CONTEXT CHECK: Penalize if examples are limited to engineering/biology. Feedback loops appear in social media, economics, relationships, climate, habits, and organizational behavior.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT feedback loops are (outputs affecting inputs). This should show WHERE feedback dynamics shape systems and behaviors around us.

${SHARED_EXPECTATIONS}
    `,
    id: "en-systems-feedback-loops",
    userInput: {
      chapterTitle: "Systems Thinking",
      courseTitle: "Understanding Complex Systems",
      explanationSteps: [
        {
          text: "A feedback loop occurs when a system's output circles back to influence its input. The result of an action affects the conditions that produced it, creating a cycle.",
          title: "Circular Causation",
        },
        {
          text: "Negative feedback stabilizes systems by counteracting change. When temperature rises, a thermostat activates cooling. The response opposes the initial change.",
          title: "Negative Feedback",
        },
        {
          text: "Positive feedback amplifies change. A microphone near a speaker creates a growing screech — sound feeds back and gets louder. Positive feedback often leads to rapid escalation.",
          title: "Positive Feedback",
        },
      ],
      language: "en",
      lessonDescription:
        "Recognizing feedback loops in technology, nature, society, and personal habits that amplify or stabilize outcomes",
      lessonTitle: "Feedback Loops Everywhere",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Opportunity cost examples must correctly identify what's being given up. Penalize if:
   - Examples confuse sunk costs with opportunity costs
   - The "next best alternative" concept is missing or incorrectly applied

2. CONTEXT CHECK: Penalize if examples are limited to money. Opportunity cost applies to time, attention, energy, relationships, career paths, and any scarce resource allocation.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT opportunity cost is (the value of the next best alternative). This should show WHERE we unconsciously make trade-offs daily.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-opportunity-cost",
    userInput: {
      chapterTitle: "Economic Thinking",
      courseTitle: "Microeconomics",
      explanationSteps: [
        {
          text: "Opportunity cost is what you give up when you choose one option over another. It's not just about money — it's about the value of your next best alternative.",
          title: "The Trade-Off",
        },
        {
          text: "Every choice has an opportunity cost because resources are scarce. Choosing to spend an hour on Netflix means not spending it on exercise, reading, or side projects.",
          title: "Scarcity Forces Choices",
        },
        {
          text: "Explicit costs are obvious — the price you pay. Implicit costs are hidden — the opportunities you forgo. True cost includes both.",
          title: "Explicit vs Implicit",
        },
      ],
      language: "en",
      lessonDescription:
        "Seeing how opportunity cost thinking reveals the hidden trade-offs in everyday decisions about time, money, and attention",
      lessonTitle: "The Hidden Cost of Every Choice",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Dopamine examples must reflect current neuroscience accurately. Penalize if:
   - Dopamine is oversimplified as just "the pleasure chemical" (it's about motivation/reward prediction)
   - Examples attribute behaviors to dopamine that involve multiple neurotransmitter systems

2. CONTEXT CHECK: Penalize if examples are limited to addiction. Dopamine is involved in motivation, learning, movement, social behavior, creativity, and goal-directed action.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT dopamine is (a neurotransmitter involved in reward). This should show WHERE dopamine influences behaviors and experiences in daily life.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-neuroscience-dopamine-life",
    userInput: {
      chapterTitle: "Neurotransmissores",
      courseTitle: "Neurociencia do Comportamento",
      explanationSteps: [
        {
          text: "A dopamina e um neurotransmissor envolvido em recompensa e motivacao. Ela nao apenas sinaliza prazer — ela antecipa recompensas e nos motiva a busca-las.",
          title: "O Papel da Dopamina",
        },
        {
          text: "O sistema de recompensa do cerebro usa dopamina para reforcar comportamentos. Quando algo e melhor do que esperado, ha um pico de dopamina que fortalece a conexao.",
          title: "Aprendizado por Recompensa",
        },
        {
          text: "A tolerancia ocorre quando o cerebro se adapta a estimulos frequentes. O mesmo estimulo produz menos dopamina com o tempo, exigindo mais para o mesmo efeito.",
          title: "Adaptacao e Tolerancia",
        },
      ],
      language: "pt",
      lessonDescription:
        "Descobrindo como a dopamina influencia motivacao, habitos, redes sociais e comportamentos do dia a dia",
      lessonTitle: "Dopamina no Cotidiano",
    },
  },
];
