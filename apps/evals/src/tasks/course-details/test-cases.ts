import { type TestCase } from "@/lib/types";
import { type CourseDetailsParams } from "@zoonk/ai/tasks/v2/courses/details";
import { type CourseDetailsExpected } from "./scorer";

const SHARED_EXPECTATIONS = `
  - The output is a course page: description (1 to 3 sentences), landingPage (valueProposition, 3 audience items and 4 outcomes, each a short phrase a visitor takes in at a glance) and 1 or 2 categories; code checks score sizes, item lengths and category validity, so don't judge them
  - valueProposition is the course's promise, the first line a visitor from a search reads under the course's name; outcomes are the page's "What you'll be able to do" list
  - CHAPTERS are only the first band written so far: the copy describes the whole course, not only those chapters
  - The page is shared by every learner of the course, so nothing is tailored to one person
  - Don't evaluate JSON formatting
`;

function chapter(level: string, title: string, description: string) {
  return { description, level, title };
}

export const TEST_CASES: TestCase<CourseDetailsExpected, CourseDetailsParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - Names concrete parts of data analysis: organizing and cleaning data, summaries, charts, drawing conclusions, checking AI's analysis
      - Uses at work (reports, decisions, marketing, operations) and everyday life (personal finances, reading statistics in the news) without promising a job

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["tech", "business", "math"] },
    id: "en-data-analysis-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "Spreadsheets for analysis",
          "Organize raw numbers into tables you can sort, filter and sum.",
        ),
        chapter(
          "beginner",
          "Cleaning messy data",
          "Fix duplicates, blanks and inconsistent formats before trusting a result.",
        ),
        chapter(
          "beginner",
          "Averages and spread",
          "Summarize a column with the right average and see how much values vary.",
        ),
        chapter(
          "beginner",
          "Charts that tell the truth",
          "Pick the chart that fits the question and avoid misleading scales.",
        ),
        chapter(
          "beginner",
          "Checking AI's analysis",
          "Ask an AI assistant for an analysis and verify its numbers and claims.",
        ),
      ],
      courseTitle: "Data analysis",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Pop culture: personal, creative, social and cultural uses (discussion, criticism, fan communities, understanding references, storytelling), never careers or jobs
      - Specific to Star Wars (its saga, characters, world-building, influence on film and franchises), not generic film copy

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["culture", "arts"] },
    id: "en-star-wars-overview",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "A saga in nine episodes",
          "How the Skywalker story unfolds across three trilogies.",
        ),
        chapter(
          "overview",
          "Myth and the hero's journey",
          "The old myths George Lucas borrowed to build his story.",
        ),
        chapter(
          "overview",
          "Building a galaxy",
          "Planets, species and technology that make the world feel lived-in.",
        ),
        chapter(
          "overview",
          "Effects that changed movies",
          "How the films pushed special effects and sound design forward.",
        ),
        chapter(
          "overview",
          "From films to a franchise",
          "Series, games and books that grew the story and its fans.",
        ),
      ],
      courseTitle: "Star Wars",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Regulated profession: the course helps someone understand contracts, read them carefully and know when to ask a lawyer; nothing says or implies giving legal advice, representing clients, drafting binding contracts for others or replacing law school or a lawyer
      - Audience examples like freelancers, small business owners, tenants or students preparing for law school fit

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["law"] },
    id: "en-contract-law-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "What makes a contract binding",
          "Offer, acceptance, consideration and when a promise becomes enforceable.",
        ),
        chapter(
          "beginner",
          "Reading the fine print",
          "Common clauses such as termination, liability limits and automatic renewals.",
        ),
        chapter(
          "beginner",
          "When contracts go wrong",
          "Breach, remedies and what courts usually award.",
        ),
        chapter(
          "beginner",
          "Contracts you sign every day",
          "Leases, job offers, app terms and freelance agreements.",
        ),
      ],
      courseTitle: "Contract law",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, including audience nouns and roles
      - Regulated field: frames the course as understanding and study of how medicines act, never as qualifying anyone to prescribe, diagnose, treat or choose doses for patients; nursing or pharmacy students, caregivers and curious people fit
      - Everyday use such as reading a package insert (bula) or talking with a doctor is welcome

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["health", "science"] },
    id: "pt-farmacologia-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "Como os remédios agem no corpo",
          "Receptores, enzimas e o caminho de um remédio da absorção à eliminação.",
        ),
        chapter(
          "beginner",
          "Doses e vias de administração",
          "Por que a mesma substância muda de efeito pela boca, na veia ou na pele.",
        ),
        chapter(
          "beginner",
          "Interações e efeitos adversos",
          "Quando dois remédios, ou um remédio e um alimento, se atrapalham.",
        ),
        chapter(
          "beginner",
          "Antibióticos e resistência",
          "Como os antibióticos funcionam e por que o uso errado cria bactérias resistentes.",
        ),
      ],
      courseTitle: "Farmacologia",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Names the big ideas of economics (escassez, preços, juros, inflação, papel do governo, comércio) in plain words; Brazilian examples are welcome
      - Includes everyday uses (orçamento pessoal, entender notícias, decidir sobre crédito) next to work and civic ones, with no promise of a job

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["economics"] },
    id: "pt-economia-overview",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "Escassez e escolhas",
          "Por que toda escolha tem um custo e como isso explica decisões do dia a dia.",
        ),
        chapter(
          "overview",
          "Preços, oferta e demanda",
          "Como os preços sobem e descem conforme o que se quer e o que existe.",
        ),
        chapter(
          "overview",
          "Dinheiro, bancos e juros",
          "O que os bancos fazem com o seu dinheiro e por que os juros mudam tudo.",
        ),
        chapter(
          "overview",
          "Inflação e poder de compra",
          "Por que o mesmo salário compra menos com o tempo e quem controla isso.",
        ),
        chapter(
          "overview",
          "O papel do governo",
          "Impostos, gastos públicos e dívida, e como afetam o país.",
        ),
      ],
      courseTitle: "Economia",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese; the course is English itself, for Brazilian learners
      - Focuses on communicating in real situations (conversas, viagens, estudo, trabalho, cultura), from first conversations to confident use
      - Never promises fluency, a certificate, an exam score or a job, and never mentions how long it takes
      - Categories don't matter for language courses: don't judge them

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-language-beginner",
    userInput: {
      chapters: [
        chapter("beginner", "Apresentações", "Dizer quem você é, de onde vem e o que faz."),
        chapter(
          "beginner",
          "No aeroporto e no hotel",
          "Fazer check-in, pedir informações e resolver problemas simples.",
        ),
        chapter("beginner", "Pedindo comida", "Ler um cardápio, pedir e pagar em um restaurante."),
        chapter(
          "beginner",
          "Rotina e horários",
          "Falar sobre o seu dia, marcar compromissos e combinar horários.",
        ),
      ],
      courseTitle: "Inglês",
      language: "pt",
      targetLanguage: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The course starts from scratch: the promise and the outcomes are for a visitor who has never studied physics. They say what the learner will be able to explain or do about real things (why atoms don't collapse, where the colors of LEDs and neon signs come from, how light can act as a wave and as a particle, what's inside a phone's chip or a laser) in everyday words
      - Regression: an earlier promise was "Use mathematical models and experimental data to explain quantum probabilities and trace how quantum effects appear in real devices", with outcomes like "Apply wave functions and the Schrödinger equation to reason about probabilities and energy levels". Mathematical models, wave functions, named equations, derivatives and integrals in the promise or as an outcome's main words fail this case
      - The math chapters belong to the course: an outcome may say the learner does the math physics uses, in plain words (working with very large and very small numbers, reading a graph), not as a list of calculus terms
      - School, curiosity and science communication uses; no promise of a grade or a career

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["science"] },
    id: "en-quantum-physics-from-scratch",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "A very small world",
          "How small atoms are, and why things that small play by different rules.",
        ),
        chapter(
          "overview",
          "Light: wave or particle?",
          "Light spreads like a wave and arrives in packets. Both are true.",
        ),
        chapter(
          "overview",
          "Inside the atom",
          "What an atom is made of, why it doesn't collapse and where colors come from.",
        ),
        chapter(
          "overview",
          "Uncertainty",
          "Why you can't know everything about a particle at once, and what measuring does.",
        ),
        chapter(
          "overview",
          "Entanglement",
          "Two particles that share one story, however far apart they are.",
        ),
        chapter(
          "overview",
          "Quantum in your phone",
          "The quantum physics inside chips, LEDs and lasers.",
        ),
        chapter(
          "beginner",
          "Fractions and percentages",
          "Fractions as divisions and percents as fractions of 100.",
        ),
        chapter(
          "beginner",
          "Linear equations",
          "Solving for an unknown by keeping both sides balanced.",
        ),
        chapter(
          "beginner",
          "Functions and graphs",
          "Functions as machines, and the graphs that show them.",
        ),
        chapter(
          "beginner",
          "Inputs and outputs in quantum experiments",
          "Use input-and-output rules to describe settings and results in simple quantum experiments.",
        ),
        chapter(
          "beginner",
          "Calibration and response functions",
          "Use input-output rules to calibrate instrument settings and recognize limits in detector response.",
        ),
        chapter(
          "beginner",
          "Reading quantum experiment plots",
          "Read values from plots of detector measurements while accounting for the ways real experimental plots are displayed.",
        ),
        chapter(
          "beginner",
          "Rates in detector data",
          "Use slopes to describe how quickly experimental quantities change, and judge when a rate estimate is reliable.",
        ),
        chapter(
          "beginner",
          "Sensitivity in quantum experiments",
          "Read slopes against experimental settings to judge instrument response and physical relationships, rather than counts changing over time.",
        ),
        chapter(
          "beginner",
          "Exponents and scientific notation",
          "Powers of ten and the notation physics uses for atoms and stars alike.",
        ),
        chapter(
          "beginner",
          "Comparing measured values",
          "Compare measurements written in different forms of scientific notation, including values that are close, rounded or uncertain.",
        ),
        chapter(
          "beginner",
          "Multi-factor calculations with scientific notation",
          "Use scientific notation in longer calculations and check whether the resulting scale and units make sense.",
        ),
        chapter(
          "beginner",
          "Powers of ten in physical scales",
          "Use powers of ten to compare the lengths, times, energies, and quantities that appear in quantum experiments.",
        ),
        chapter(
          "beginner",
          "Calculating with scientific notation",
          "Calculate and judge results expressed in scientific notation without losing track of units or measurement precision.",
        ),
        chapter(
          "beginner",
          "Vectors",
          "Quantities with a size and a direction, like velocity and force.",
        ),
        chapter(
          "beginner",
          "Vectors in coordinates",
          "Describe arrows precisely with coordinates and components, including directions in three dimensions.",
        ),
        chapter(
          "beginner",
          "Vector alignment and projections",
          "Use vector length, direction, and alignment to prepare for describing quantum states without repeating vector resultants.",
        ),
        chapter(
          "beginner",
          "Resultants from vector components",
          "Add vectors by their components to handle longer paths and three-dimensional directions.",
        ),
        chapter("intermediate", "Derivatives", "How fast things change, at any instant."),
        chapter(
          "intermediate",
          "Instantaneous quantum dynamics",
          "Use instantaneous rates to track how quantum states change, even when a measurement probability stays constant.",
        ),
        chapter(
          "intermediate",
          "Rates under changing quantum controls",
          "Use instantaneous rates to analyze a quantum system whose external controls change over time, from energy shifts to transitions between changing states.",
        ),
        chapter(
          "intermediate",
          "Quantum potentials and wavefunction curvature",
          "Apply the power rule to polynomial and inverse-power models of quantum potentials and wavefunctions.",
        ),
        chapter(
          "intermediate",
          "Energy-band motion and spectral slopes",
          "Use power-rule derivatives to connect quantum energy curves to motion, responses, level spacing, and the number of available states.",
        ),
        chapter("intermediate", "Integrals", "Adding up tiny pieces to get a whole."),
        chapter(
          "intermediate",
          "Motion and forces",
          "Newton's laws and the energy that never disappears.",
        ),
      ],
      courseTitle: "Quantum physics from scratch",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, natural and informal ("você"), not translated from English
      - The course starts "do zero": the promise and the outcomes are for a visitor who never studied physics. They say what the learner will be able to explain or do about real things (por que o átomo não desaba, de onde vêm as cores de um LED ou de um letreiro de neon, como a luz pode ser onda e partícula, o que tem de quântico num celular ou num laser) in everyday words
      - Regression: an earlier promise was "Você poderá acompanhar as ideias centrais da física quântica e relacioná-las à matemática e a tecnologias do cotidiano". A promise built on abstract verbs ("acompanhar as ideias centrais", "relacionar"), an opener like "Você poderá" before the outcome, or outcomes centered on "função de onda" or "equação de Schrödinger" fail this case
      - Regression: an earlier outcome was "Usar potências de dez, unidades, equações e gráficos para fazer contas com grandezas muito pequenas", too dense for the page. Outcomes that list tools or topics, or add a clause on how or why, fail this case
      - The math chapters belong to the course: an outcome may say the learner does the math physics uses, in plain words (fazer contas com números muito grandes e muito pequenos, ler um gráfico), not as a list of calculus terms
      - School, curiosity and science communication uses; no promise of a grade or a career

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["science"] },
    id: "pt-fisica-quantica-do-zero",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "Um mundo muito pequeno",
          "Quão pequenos são os átomos, e por que coisas tão pequenas seguem outras regras.",
        ),
        chapter(
          "overview",
          "Luz: onda ou partícula?",
          "A luz se espalha como onda e chega em pacotes. As duas coisas são verdade.",
        ),
        chapter(
          "overview",
          "Dentro do átomo",
          "Do que um átomo é feito, por que ele não colapsa e de onde vêm as cores.",
        ),
        chapter(
          "overview",
          "Quando um átomo perde um elétron",
          "O estado fundamental impede o colapso do átomo, mas energia suficiente pode arrancar um elétron.",
        ),
        chapter(
          "overview",
          "Da energia do fóton ao comprimento de onda",
          "A energia de um fóton permite encontrar o comprimento de sua onda de luz.",
        ),
        chapter(
          "overview",
          "Incerteza",
          "Por que não dá para saber tudo sobre uma partícula ao mesmo tempo, e o que a medição faz.",
        ),
        chapter(
          "overview",
          "Emaranhamento",
          "Duas partículas que compartilham uma história, por mais longe que estejam.",
        ),
        chapter(
          "overview",
          "O quântico no seu celular",
          "A física quântica dentro de chips, LEDs e lasers.",
        ),
        chapter(
          "beginner",
          "Frações e porcentagens",
          "Frações como divisões e porcentagens como frações de 100.",
        ),
        chapter(
          "beginner",
          "Equações do primeiro grau",
          "Achar uma incógnita mantendo os dois lados em equilíbrio.",
        ),
        chapter(
          "beginner",
          "Funções e gráficos",
          "Funções como máquinas, e os gráficos que as mostram.",
        ),
        chapter(
          "beginner",
          "Regras, domínios e composições",
          "Funções podem ter entradas permitidas, regras por trechos e relações com outras funções; essas escolhas ajudam a descrever situações físicas sem perder o sentido dos números.",
        ),
        chapter(
          "beginner",
          "Famílias de funções em modelos físicos",
          "Modelos de função ajudam a reconhecer como uma grandeza depende de outra antes de estudar fenômenos quânticos em detalhe.",
        ),
        chapter(
          "beginner",
          "Leitura de curvas e escalas",
          "Gráficos com curvas, trechos e várias séries exigem atenção à escala e à legenda antes de tirar conclusões sobre os valores.",
        ),
        chapter(
          "beginner",
          "Taxas em curvas e medições",
          "A taxa de variação permite comparar mudanças em trechos de uma curva e em dados medidos, mesmo quando a inclinação não é sempre a mesma.",
        ),
        chapter(
          "beginner",
          "Variações em modelos não lineares",
          "Diferenças entre valores revelam como a taxa de variação se comporta em modelos que não têm inclinação constante.",
        ),
        chapter(
          "beginner",
          "Potências e notação científica",
          "Potências de dez e a notação que a física usa tanto para átomos quanto para estrelas.",
        ),
        chapter(
          "beginner",
          "Escalas microscópicas e conversão de unidades",
          "Potências de dez ajudam a comparar tamanhos extremos e a manter as unidades corretas em cálculos sobre o mundo microscópico.",
        ),
        chapter("beginner", "Vetores", "Grandezas com tamanho e direção, como velocidade e força."),
        chapter(
          "intermediate",
          "Derivadas",
          "A rapidez com que as coisas mudam, em qualquer instante.",
        ),
        chapter("intermediate", "Integrais", "Somar pedaços minúsculos para chegar ao todo."),
        chapter(
          "intermediate",
          "Movimento e forças",
          "As leis de Newton e a energia que nunca desaparece.",
        ),
        chapter("intermediate", "Ondas", "O que todas as ondas têm em comum, do som à luz."),
        chapter(
          "intermediate",
          "Eletricidade e magnetismo",
          "Cargas, campos e a descoberta de que a luz é eletromagnética.",
        ),
        chapter(
          "advanced",
          "A função de onda",
          "A função de onda e as probabilidades que ela guarda.",
        ),
        chapter(
          "advanced",
          "A equação de Schrödinger",
          "A equação por trás de cada nível de energia.",
        ),
        chapter(
          "advanced",
          "Spin",
          "Uma propriedade sem par no cotidiano: só para cima ou para baixo.",
        ),
        chapter(
          "advanced",
          "Emaranhamento e computação quântica",
          "Qubits, emaranhamento e os experimentos que encerraram um debate.",
        ),
      ],
      courseTitle: "Física quântica do zero",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, natural and informal ("você"), in a high school student's words
      - Exam preparation: the promise opens with what the student will be able to do on the Enem (resolver as questões que mais caem, ler gráficos e textos da prova, escrever a redação que a prova pede), framed as preparation. Never a score, a pass, a place at a university or "aprovação"
      - Regression: an earlier promise was "Você poderá aplicar conteúdos de diferentes áreas e critérios da redação para resolver questões e planejar suas respostas no ENEM". A promise built on abstract terms ("aplicar conteúdos de diferentes áreas", "critérios da redação", "competências avaliadas") or an opener like "Você poderá" before the outcome fails this case
      - CHAPTERS are only the first band (math, data, waves, reading, ecology): the copy covers the whole exam, its four areas and the redação
      - Don't judge how the exam's name is capitalized
      - Categories don't matter for exam courses: don't judge them

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-enem-exam",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "Porcentagem",
          "Descontos, aumentos e juros: a matemática que o ENEM cobra em quase toda edição.",
        ),
        chapter(
          "beginner",
          "Cadeias de reajustes percentuais",
          "Trata cadeias maiores de reajustes percentuais e mostra como conferir a base e o efeito de cada etapa.",
        ),
        chapter(
          "beginner",
          "Preço final em ofertas com condições",
          "Calcula o valor a pagar quando descontos dependem de regras da oferta, além da porcentagem anunciada.",
        ),
        chapter(
          "beginner",
          "Desconto real em compras por quantidade",
          "Interpreta o desconto real de promoções por quantidade quando a compra não é exatamente um único grupo de itens iguais.",
        ),
        chapter(
          "beginner",
          "Percentuais além dos casos inteiros",
          "Você usa a forma decimal de percentuais menos imediatos para interpretar quantidades e resolver questões do ENEM.",
        ),
        chapter(
          "beginner",
          "Fatores percentuais em valores compostos",
          "Usa fatores percentuais em situações nas quais é preciso reconhecer a base da variação antes de multiplicar.",
        ),
        chapter("beginner", "Razão e proporção", "Proporções, regra de três e escalas."),
        chapter(
          "beginner",
          "Proporcionalidade inversa e composta",
          "Amplia a regra de três para situações em que as grandezas variam em sentidos opostos ou dependem de mais de dois fatores.",
        ),
        chapter(
          "beginner",
          "Escalas em mapas, plantas e maquetes",
          "Aplique a regra de três a mapas, plantas e modelos, observando quando a escala afeta comprimentos, áreas e volumes de maneiras diferentes.",
        ),
        chapter(
          "beginner",
          "Partilhas e rateios proporcionais",
          "Partilhas e rateios em que a razão define quanto cabe a cada pessoa ou grupo, inclusive quando há parcelas fixas ou itens indivisíveis.",
        ),
        chapter(
          "beginner",
          "Concentrações e transformações de misturas",
          "Use proporções para interpretar concentrações e resolver mudanças em misturas, sem confundir a quantidade de ingrediente com a quantidade total.",
        ),
        chapter("intermediate", "Funções", "Funções do 1º e do 2º grau em situações do dia a dia."),
        chapter(
          "intermediate",
          "Modelos lineares em tarifas e faixas",
          "Usa modelos lineares para interpretar tarifas, comparar alternativas e reconhecer onde uma regra deixa de valer.",
        ),
        chapter(
          "intermediate",
          "Otimização quadrática com restrições",
          "Aplica o vértice da parábola a problemas de máximo e mínimo com restrições, unidades e dados apresentados de diferentes formas.",
        ),
        chapter(
          "intermediate",
          "Estatística",
          "Médias e os gráficos que o ENEM usa em tantas questões.",
        ),
        chapter(
          "intermediate",
          "Medidas centrais em conjuntos de dados",
          "Amplia o uso das medidas de tendência central em situações com pesos, frequências e conjuntos de dados diferentes.",
        ),
        chapter(
          "intermediate",
          "Comparações e distorções em gráficos",
          "Trabalha comparações mais difíceis em gráficos, distinguindo mudanças reais de efeitos da apresentação dos dados.",
        ),
        chapter(
          "intermediate",
          "Dados de biodiversidade e classificação",
          "Usa dados de biodiversidade para aprofundar a leitura de tabelas e gráficos e distinguir grupos de seres vivos.",
        ),
        chapter(
          "intermediate",
          "Painéis visuais e representações de ondas",
          "Amplia a leitura de gráficos para painéis e textos que combinam dados, imagens e palavras, incluindo representações da propagação de ondas.",
        ),
        chapter(
          "intermediate",
          "Leitura de distribuições estatísticas",
          "Leitura de distribuições em tabelas e gráficos, com atenção ao total usado em cada comparação.",
        ),
        chapter(
          "intermediate",
          "Interações e padrões na propagação de ondas",
          "Aprofunda a propagação das ondas por meio de fenômenos que aparecem em sons, luz e cordas vibrantes, com foco na interpretação de situações e afirmações típicas do ENEM.",
        ),
        chapter(
          "intermediate",
          "Energia e trajetórias na propagação do som",
          "Aplica a propagação de ondas a situações de acústica, distinguindo mudanças de velocidade, intensidade e energia.",
        ),
        chapter(
          "intermediate",
          "Trajetórias de ondas em materiais e exames",
          "Aplique a propagação de ondas à formação de imagens, à transmissão de sinais e ao estudo do interior da Terra.",
        ),
        chapter(
          "intermediate",
          "Sentido e contexto em gêneros multimodais",
          "Trabalha a leitura conjunta de palavras, imagens e sequências em gêneros que exigem atenção ao contexto, ao enquadramento e à circulação do texto.",
        ),
        chapter(
          "intermediate",
          "Leitura de textos multimodais",
          "Palavras, imagens e elementos gráficos dividem a construção do sentido em anúncios, campanhas, tirinhas e infográficos.",
        ),
        chapter(
          "intermediate",
          "Documentos e serviços em textos multimodais",
          "Relacione palavras, símbolos e disposição visual em documentos e serviços do cotidiano.",
        ),
        chapter(
          "intermediate",
          "Ecologia",
          "Cadeias alimentares, ciclos e o impacto humano nos ecossistemas.",
        ),
        chapter(
          "intermediate",
          "Ecologia: Destinos da energia nas teias alimentares",
          "Examina para onde vai a energia que não chega ao consumidor seguinte e como as relações alimentares alteram o fluxo de energia.",
        ),
        chapter(
          "intermediate",
          "Ecologia: Estimativas de energia em teias alimentares",
          "Aplica dados de eficiência, unidades e caminhos alimentares para resolver estimativas de energia além de uma cadeia simples.",
        ),
        chapter(
          "intermediate",
          "Eletricidade",
          "Corrente, tensão e resistência em circuitos simples.",
        ),
      ],
      courseTitle: "ENEM",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Level-appropriate, not dumbed down: the title names an advanced level and the chapters start at intermediate, so the visitor already plays and reads music. Terms that visitor uses (chords, keys, scales, seventh chords, modulation) are fine and shouldn't be replaced by vaguer words; the promise still opens with a concrete result (reharmonize a song, change key without a jolt, write richer chord progressions)
      - Hobby and creative uses (playing, songwriting, arranging, playing in a band), never careers or jobs

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["arts"] },
    id: "en-advanced-music-theory",
    userInput: {
      chapters: [
        chapter(
          "intermediate",
          "Seventh chords in every key",
          "Build and spell the four common seventh chords and hear where each one wants to go.",
        ),
        chapter(
          "intermediate",
          "Secondary dominants",
          "Borrow a dominant chord to lean toward any chord in the key.",
        ),
        chapter(
          "intermediate",
          "Borrowed chords",
          "Mix chords from the parallel minor into a major song for color.",
        ),
        chapter(
          "advanced",
          "Changing key",
          "Move a song to a new key through a pivot chord or a sudden shift.",
        ),
        chapter(
          "advanced",
          "Voice leading",
          "Connect chords so each voice moves as little as it can.",
        ),
        chapter(
          "advanced",
          "Reharmonizing a melody",
          "Keep a melody and change the chords under it to change its mood.",
        ),
      ],
      courseTitle: "Advanced music theory",
      language: "en",
    },
  },
];
