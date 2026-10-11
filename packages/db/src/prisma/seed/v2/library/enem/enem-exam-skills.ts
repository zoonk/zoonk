import { t } from "../../_utils/localize";
import { skill } from "../content";

/**
 * The rest of ENEM's skill graph: the skills an ENEM goal plans that the course has no lessons for
 * yet, which the Library writes as learners reach them. From a real ENEM goal's graph (Medicina at
 * UFMG, exported on 10 Oct 2026), without the ones the course's own skills stand for (see
 * `anaGraph`).
 */
export const enemExamSkills = [
  skill("physical-units", "intermediate", {
    description: t(
      "Read physical quantities with their units and convert between units to compare measurements.",
      "Ler grandezas físicas com suas unidades e converter entre unidades para comparar medidas.",
    ),
    name: t("Interpret physical measures and units", "Interpretar medidas e unidades físicas"),
  }),
  skill(
    "motion-graphs",
    "intermediate",
    {
      description: t(
        "Read position, velocity and acceleration from graphs and tables of a motion.",
        "Ler posição, velocidade e aceleração em gráficos e tabelas de um movimento.",
      ),
      name: t("Interpret motion graphs", "Interpretar gráficos de movimento"),
    },
    { prerequisites: ["physical-units"] },
  ),
  skill(
    "forces-equilibrium",
    "intermediate",
    {
      description: t(
        "Identify the forces on a body and judge when their effects cancel out in a physical situation.",
        "Identificar forças e julgar quando seus efeitos se compensam em uma situação física.",
      ),
      name: t("Analyze forces and equilibrium", "Analisar forças e equilíbrio"),
    },
    { prerequisites: ["physical-units"] },
  ),
  skill("charges-fields", "intermediate", {
    description: t(
      "Explain electrification, how charges interact and how electric fields act.",
      "Explicar eletrização, interações entre cargas e a ação de campos elétricos.",
    ),
    name: t("Explain electric charges and fields", "Explicar cargas e campos elétricos"),
  }),
  skill(
    "wave-propagation",
    "intermediate",
    {
      description: t(
        "Relate frequency, wavelength and speed to how oscillations and waves travel.",
        "Relacionar frequência, comprimento de onda e velocidade à propagação de oscilações e ondas.",
      ),
      name: t("Analyze how waves travel", "Analisar a propagação de ondas"),
    },
    { prerequisites: ["physical-units"] },
  ),
  skill(
    "heat-exchange",
    "intermediate",
    {
      description: t(
        "Tell temperature from heat and analyze heat exchange and changes of state.",
        "Distinguir temperatura de calor e analisar trocas térmicas e mudanças de estado.",
      ),
      name: t("Analyze heat exchange", "Analisar trocas de calor"),
    },
    { prerequisites: ["physical-units"] },
  ),
  skill("material-properties", "intermediate", {
    description: t(
      "Compare observable properties to identify materials, mixtures and physical changes.",
      "Comparar propriedades observáveis para identificar materiais, misturas e mudanças físicas.",
    ),
    name: t("Compare properties of materials", "Comparar propriedades dos materiais"),
  }),
  skill("atomic-models", "intermediate", {
    description: t(
      "Use atomic models and subatomic particles to explain what matter is made of.",
      "Usar modelos atômicos e partículas subatômicas para explicar a constituição da matéria.",
    ),
    name: t("Interpret atomic models", "Interpretar modelos atômicos"),
  }),
  skill(
    "periodic-properties",
    "intermediate",
    {
      description: t(
        "Use the periodic table's organization to compare the elements' traits and properties.",
        "Usar a organização periódica para comparar características e propriedades dos elementos.",
      ),
      name: t("Compare periodic properties", "Comparar propriedades periódicas"),
    },
    { prerequisites: ["atomic-models"] },
  ),
  skill(
    "bonds-properties",
    "intermediate",
    {
      description: t(
        "Tell ionic, covalent and metallic bonds apart and relate them to the properties of substances.",
        "Distinguir ligações iônicas, covalentes e metálicas e relacioná-las às propriedades das substâncias.",
      ),
      name: t("Relate chemical bonds to properties", "Relacionar ligações e propriedades"),
    },
    { prerequisites: ["atomic-models", "periodic-properties"] },
  ),
  skill(
    "chemical-reactions",
    "intermediate",
    {
      description: t(
        "Write and balance chemical equations that represent what happens in a reaction.",
        "Escrever e balancear equações químicas que representam o que acontece numa reação.",
      ),
      name: t("Represent chemical reactions", "Representar reações químicas"),
    },
    { prerequisites: ["atomic-models"] },
  ),
  skill("biomolecules", "intermediate", {
    description: t(
      "Relate carbohydrates, lipids, proteins and nucleic acids to their biological functions.",
      "Relacionar carboidratos, lipídios, proteínas e ácidos nucleicos às suas funções biológicas.",
    ),
    name: t(
      "Relate biomolecules to cell functions",
      "Relacionar biomoléculas às funções celulares",
    ),
  }),
  skill(
    "how-cells-work",
    "intermediate",
    {
      description: t(
        "Relate the membrane, organelles and the transport of substances to how a cell works.",
        "Relacionar membrana, organelas e transporte de substâncias ao funcionamento celular.",
      ),
      name: t("Explain how cells work", "Explicar o funcionamento celular"),
    },
    { prerequisites: ["biomolecules"] },
  ),
  skill("groups-of-living-beings", "intermediate", {
    description: t(
      "Classify living beings into groups by their traits and relate the groups to how they live.",
      "Classificar seres vivos em grupos por suas características e relacionar os grupos ao modo como vivem.",
    ),
    name: t("Tell groups of living beings apart", "Distinguir grupos de seres vivos"),
  }),
  skill("estimate-numbers", "intermediate", {
    description: t(
      "Compare rational and real numbers and check whether numerical results make sense in context.",
      "Comparar números racionais e reais e verificar se resultados numéricos fazem sentido em situações contextualizadas.",
    ),
    name: t("Compare and estimate numbers", "Comparar e estimar grandezas numéricas"),
  }),
  skill(
    "powers-magnitudes",
    "beginner",
    {
      description: t(
        "Use powers of ten and orders of magnitude to compare very large and very small numbers.",
        "Usar potências de dez e ordens de grandeza para comparar números muito grandes e muito pequenos.",
      ),
      name: t("Compare powers and orders of magnitude", "Comparar potências e ordens de grandeza"),
    },
    { prerequisites: ["estimate-numbers"] },
  ),
  skill(
    "simple-probability",
    "intermediate",
    {
      description: t(
        "Count favorable and possible outcomes to find the probability of an event.",
        "Contar casos favoráveis e possíveis para encontrar a probabilidade de um evento.",
      ),
      name: t("Work out simple probabilities", "Calcular probabilidades simples"),
    },
    { prerequisites: ["rule-of-three"] },
  ),
  skill("perimeters-areas", "intermediate", {
    description: t(
      "Find the perimeter and area of plane figures in everyday problems.",
      "Calcular o perímetro e a área de figuras planas em problemas do cotidiano.",
    ),
    name: t("Find perimeters and areas", "Determinar perímetros e áreas"),
  }),
  skill("equations", "intermediate", {
    description: t(
      "Represent relations with algebraic expressions and solve first-degree equations in problems.",
      "Representar relações por expressões algébricas e resolver equações do primeiro grau em problemas.",
    ),
    name: t("Represent relations and solve equations", "Representar relações e resolver equações"),
  }),
  skill(
    "function-representations",
    "intermediate",
    {
      description: t(
        "Relate a function's domain, values and change to its rules, tables and graphs.",
        "Relacionar domínio, valores e variação de uma função a suas representações por regras, tabelas e gráficos.",
      ),
      name: t("Interpret how functions are represented", "Interpretar representações de funções"),
    },
    { prerequisites: ["equations"] },
  ),
  skill("discourse-sequences", "intermediate", {
    description: t(
      "Tell how narration, description, exposition and argument organize a text's meaning.",
      "Distinguir como narração, descrição, exposição e argumentação organizam os sentidos de um texto.",
    ),
    name: t("Tell discourse sequences apart", "Distinguir sequências discursivas"),
  }),
  skill("texts-in-context", "intermediate", {
    description: t(
      "Explain how where a text circulates and how it was produced change how it reads.",
      "Explicar como o meio de circulação e o contexto de produção afetam a interpretação de um texto.",
    ),
    name: t("Relate texts to where they circulate", "Relacionar textos e contextos de circulação"),
  }),
  skill("multimodal-texts", "intermediate", {
    description: t(
      "Relate words, images and other resources to interpret texts of different genres.",
      "Relacionar palavras, imagens e outros recursos para interpretar textos de diferentes gêneros.",
    ),
    name: t("Interpret multimodal texts", "Interpretar textos multimodais"),
  }),
  skill("language-variation", "intermediate", {
    description: t(
      "Identify varieties of Portuguese and explain how they relate to groups and situations of use.",
      "Identificar variedades da língua portuguesa e explicar sua relação com grupos e situações de uso.",
    ),
    name: t("Recognize linguistic variation", "Reconhecer variação linguística"),
  }),
  skill("word-choice-effects", "intermediate", {
    description: t(
      "Explain the effect a word choice has on a text's meaning.",
      "Explicar o efeito de uma escolha lexical no sentido de um texto.",
    ),
    name: t("Interpret the effects of word choice", "Interpretar efeitos de escolhas lexicais"),
  }),
  skill("cultural-identities", "intermediate", {
    description: t(
      "Relate cultural identities, customs and ways of living together to the history that shaped them.",
      "Relacionar identidades culturais, costumes e formas de convivência às condições históricas em que se formam.",
    ),
    name: t("Analyze how cultural identities form", "Analisar a formação de identidades culturais"),
  }),
  skill("colonial-relations", "intermediate", {
    description: t(
      "Explain how the colonization of the Americas produced land disputes, social hierarchies and cultural exchange.",
      "Explicar como a colonização das Américas produziu disputas territoriais, hierarquias sociais e intercâmbios culturais.",
    ),
    name: t("Explain colonial conflicts and relations", "Explicar conflitos e relações coloniais"),
  }),
  skill("production-and-labor", "intermediate", {
    description: t(
      "Compare farming and other ways of organizing work by ownership, technique and social relations.",
      "Comparar a produção agrária e outras formas de organização do trabalho segundo a propriedade, a técnica e as relações sociais.",
    ),
    name: t(
      "Compare production systems and labor relations",
      "Comparar sistemas produtivos e relações de trabalho",
    ),
  }),
  skill("natural-domains", "intermediate", {
    description: t(
      "Relate climate, landforms, vegetation and natural dynamics to where natural domains lie.",
      "Relacionar clima, relevo, vegetação e dinâmica natural à distribuição dos domínios naturais.",
    ),
    name: t("Relate the elements of natural domains", "Relacionar elementos dos domínios naturais"),
  }),
  skill("map-scale-coordinates", "intermediate", {
    description: t(
      "Use scale, direction and coordinates to read distances and locations on maps.",
      "Usar escala, orientação e coordenadas para interpretar distâncias e localizações em mapas.",
    ),
    name: t(
      "Interpret scale, direction and coordinates",
      "Interpretar escala, orientação e coordenadas",
    ),
  }),
  skill(
    "motion-problems",
    "intermediate",
    {
      description: t(
        "Find displacements, speeds and accelerations in uniform and accelerated motion.",
        "Determinar deslocamentos, velocidades e acelerações em movimentos uniformes e variados.",
      ),
      name: t("Solve motion problems", "Resolver problemas de movimento"),
    },
    { prerequisites: ["motion-graphs"] },
  ),
  skill(
    "newtons-laws",
    "intermediate",
    {
      description: t(
        "Use Newton's three laws to explain and predict how forces change a body's motion.",
        "Usar as três leis de Newton para explicar e prever como forças alteram o movimento de um corpo.",
      ),
      name: t("Apply Newton's laws", "Aplicar as leis de Newton"),
    },
    { prerequisites: ["motion-problems", "forces-equilibrium"] },
  ),
  skill(
    "work-energy-power",
    "intermediate",
    {
      description: t(
        "Relate force, displacement, work, energy and power in problems set in context.",
        "Relacionar força, deslocamento, trabalho, energia e potência em problemas contextualizados.",
      ),
      name: t("Relate work, energy and power", "Relacionar trabalho, energia e potência"),
    },
    { prerequisites: ["forces-equilibrium", "motion-problems"] },
  ),
  skill(
    "energy-conservation",
    "intermediate",
    {
      description: t(
        "Track how energy changes form while the total stays the same in a mechanical system.",
        "Acompanhar como a energia muda de forma enquanto o total se conserva num sistema mecânico.",
      ),
      name: t("Apply energy conservation", "Aplicar a conservação da energia"),
    },
    { prerequisites: ["work-energy-power"] },
  ),
  skill(
    "fluids-hydraulics",
    "intermediate",
    {
      description: t(
        "Analyze pressure, buoyancy and how liquids and hydraulic devices pass on forces.",
        "Analisar pressão, empuxo e transmissão de forças em líquidos e dispositivos hidráulicos.",
      ),
      name: t("Analyze fluids and hydraulic systems", "Analisar fluidos e sistemas hidráulicos"),
    },
    { prerequisites: ["forces-equilibrium"] },
  ),
  skill(
    "electricity-use",
    "intermediate",
    {
      description: t(
        "Estimate the power, consumption and cost of electricity from circuits and appliances.",
        "Estimar potência, consumo e custo da energia elétrica a partir de circuitos e aparelhos.",
      ),
      name: t("Estimate electricity use", "Estimar o consumo elétrico"),
    },
    { prerequisites: ["ohms-law"] },
  ),
  skill(
    "optics",
    "intermediate",
    {
      description: t(
        "Explain reflection, refraction and how images form in optical phenomena and instruments.",
        "Explicar reflexão, refração e formação de imagens em fenômenos e instrumentos ópticos.",
      ),
      name: t("Explain optical phenomena", "Explicar fenômenos ópticos"),
    },
    { prerequisites: ["wave-propagation"] },
  ),
  skill(
    "gases-heat-engines",
    "intermediate",
    {
      description: t(
        "Relate the pressure, volume and temperature of gases and judge how heat turns into work.",
        "Relacionar pressão, volume e temperatura dos gases e avaliar a conversão de calor em trabalho.",
      ),
      name: t("Analyze gases and heat engines", "Analisar gases e máquinas térmicas"),
    },
    { prerequisites: ["work-energy-power", "heat-exchange"] },
  ),
  skill(
    "stoichiometry",
    "intermediate",
    {
      description: t(
        "Use the proportions in a balanced equation to find the amounts of reactants and products.",
        "Usar as proporções de uma equação balanceada para calcular quantidades de reagentes e produtos.",
      ),
      name: t("Solve stoichiometric proportions", "Resolver proporções estequiométricas"),
    },
    { prerequisites: ["chemical-reactions"] },
  ),
  skill(
    "chemical-changes",
    "intermediate",
    {
      description: t(
        "Tell chemical transformations from physical ones by the evidence and the substances involved.",
        "Distinguir transformações químicas de físicas pelas evidências e pelas substâncias envolvidas.",
      ),
      name: t("Tell chemical transformations apart", "Distinguir transformações químicas"),
    },
    { prerequisites: ["chemical-reactions", "bonds-properties"] },
  ),
  skill(
    "aqueous-solutions",
    "intermediate",
    {
      description: t(
        "Interpret solubility, dilution and concentration in aqueous solutions.",
        "Interpretar solubilidade, diluição e concentração em soluções aquosas.",
      ),
      name: t("Analyze aqueous solutions", "Analisar soluções aquosas"),
    },
    { prerequisites: ["material-properties"] },
  ),
  skill(
    "reaction-energy",
    "intermediate",
    {
      description: t(
        "Tell reactions that release heat from those that absorb it and compare the energy involved.",
        "Distinguir reações que liberam calor das que absorvem e comparar a energia envolvida.",
      ),
      name: t("Analyze energy in reactions", "Analisar energia nas reações"),
    },
    { prerequisites: ["chemical-changes"] },
  ),
  skill(
    "reaction-rates",
    "intermediate",
    {
      description: t(
        "Explain how temperature, concentration, surface area and catalysts change how fast reactions go.",
        "Explicar como temperatura, concentração, superfície e catalisadores afetam a velocidade das reações.",
      ),
      name: t("Explain reaction rates", "Explicar a velocidade das reações"),
    },
    { prerequisites: ["chemical-changes"] },
  ),
  skill(
    "organic-functions",
    "intermediate",
    {
      description: t(
        "Recognize the functional groups of carbon compounds and relate them to their properties and uses.",
        "Reconhecer os grupos funcionais dos compostos de carbono e relacioná-los às suas propriedades e usos.",
      ),
      name: t("Recognize organic functions", "Reconhecer funções orgânicas"),
    },
    { prerequisites: ["bonds-properties"] },
  ),
  skill(
    "ph-neutralization",
    "intermediate",
    {
      description: t(
        "Use pH and neutralization to explain situations with acids and bases.",
        "Interpretar pH e neutralização para explicar situações envolvendo ácidos e bases.",
      ),
      name: t("Interpret pH and neutralization", "Interpretar pH e neutralização"),
    },
    { prerequisites: ["aqueous-solutions", "bonds-properties"] },
  ),
  skill(
    "cell-energy",
    "intermediate",
    {
      description: t(
        "Compare photosynthesis and cellular respiration by their inputs, products and energy transfers.",
        "Comparar fotossíntese e respiração celular pelas entradas, produtos e transferências de energia.",
      ),
      name: t("Compare how cells get energy", "Comparar processos energéticos celulares"),
    },
    { prerequisites: ["how-cells-work"] },
  ),
  skill(
    "tissues-organs",
    "intermediate",
    {
      description: t(
        "Relate the tissues and organs of plants and animals to the functions they carry out.",
        "Relacionar tecidos e órgãos de plantas e animais às funções que desempenham.",
      ),
      name: t("Relate tissues, organs and functions", "Relacionar tecidos, órgãos e funções"),
    },
    { prerequisites: ["how-cells-work"] },
  ),
  skill(
    "gene-expression",
    "intermediate",
    {
      description: t(
        "Explain how DNA's information is copied, expressed and changed by mutations.",
        "Explicar como a informação do DNA é copiada, expressa e alterada por mutações.",
      ),
      name: t(
        "Explain how genetic information is expressed",
        "Explicar a expressão da informação genética",
      ),
    },
    { prerequisites: ["how-cells-work"] },
  ),
  skill(
    "heredity-problems",
    "intermediate",
    {
      description: t(
        "Interpret crosses, pedigrees and probabilities to explain how traits are passed on.",
        "Interpretar cruzamentos, heredogramas e probabilidades para explicar a transmissão de características.",
      ),
      name: t("Solve heredity problems", "Resolver problemas de hereditariedade"),
    },
    { prerequisites: ["gene-expression"] },
  ),
  skill(
    "reproduction-life-cycles",
    "intermediate",
    {
      description: t(
        "Compare cell division, reproduction and life cycles to explain continuity and diversity.",
        "Comparar divisão celular, reprodução e ciclos de vida para explicar continuidade e diversidade.",
      ),
      name: t("Compare reproduction and life cycles", "Comparar reprodução e ciclos de vida"),
    },
    { prerequisites: ["how-cells-work"] },
  ),
  skill(
    "population-dynamics",
    "intermediate",
    {
      description: t(
        "Analyze population growth, limiting factors and changes in communities.",
        "Analisar crescimento populacional, fatores limitantes e mudanças nas comunidades.",
      ),
      name: t("Analyze population dynamics", "Analisar a dinâmica das populações"),
    },
    { prerequisites: ["energy-flow"] },
  ),
  skill(
    "interest",
    "intermediate",
    {
      description: t(
        "Compare simple and compound interest to judge loans, installments and investments.",
        "Comparar juros simples e compostos para avaliar empréstimos, parcelamentos e investimentos.",
      ),
      name: t("Weigh simple and compound interest", "Avaliar juros simples e compostos"),
    },
    { prerequisites: ["percent-basics"] },
  ),
  skill(
    "progressions",
    "intermediate",
    {
      description: t(
        "Spot patterns and find terms or sums in arithmetic and geometric progressions.",
        "Identificar regularidades e determinar termos ou somas em progressões numéricas.",
      ),
      name: t("Analyze number progressions", "Analisar progressões numéricas"),
    },
    { prerequisites: ["equations"] },
  ),
  skill("counting", "intermediate", {
    description: t(
      "Use the counting principle, arrangements and combinations to count the possible cases.",
      "Usar o princípio multiplicativo, arranjos e combinações para contar os casos possíveis.",
    ),
    name: t("Count possibilities in problems", "Contar possibilidades em problemas"),
  }),
  skill(
    "conditional-probability",
    "intermediate",
    {
      description: t(
        "Work out probabilities again when a condition narrows the possible outcomes.",
        "Recalcular probabilidades quando uma condição restringe os resultados possíveis.",
      ),
      name: t("Weigh conditional probabilities", "Avaliar probabilidades condicionais"),
    },
    { prerequisites: ["simple-probability"] },
  ),
  skill(
    "similar-figures",
    "intermediate",
    {
      description: t(
        "Use similar figures to find lengths and read geometric scales.",
        "Usar semelhança de figuras para obter comprimentos e interpretar escalas geométricas.",
      ),
      name: t("Apply similarity of figures", "Aplicar semelhança de figuras"),
    },
    { prerequisites: ["rule-of-three"] },
  ),
  skill(
    "triangles",
    "intermediate",
    {
      description: t(
        "Relate angles, trigonometric ratios and sides of triangles to find distances and heights.",
        "Relacionar ângulos, razões trigonométricas e lados de triângulos para determinar distâncias e alturas.",
      ),
      name: t(
        "Solve triangles in geometric situations",
        "Resolver triângulos em situações geométricas",
      ),
    },
    { prerequisites: ["similar-figures"] },
  ),
  skill(
    "solid-areas-volumes",
    "intermediate",
    {
      description: t(
        "Find the surface area and volume of prisms, cylinders, cones and spheres in problems.",
        "Calcular a área da superfície e o volume de prismas, cilindros, cones e esferas em problemas.",
      ),
      name: t("Find areas and volumes of solids", "Determinar áreas e volumes de sólidos"),
    },
    { prerequisites: ["perimeters-areas"] },
  ),
  skill(
    "systems-inequalities",
    "intermediate",
    {
      description: t(
        "Turn a problem's constraints into systems or inequalities and interpret their solutions.",
        "Traduzir restrições de problemas em sistemas ou inequações e interpretar suas soluções.",
      ),
      name: t("Solve systems and inequalities", "Resolver sistemas e inequações"),
    },
    { prerequisites: ["equations"] },
  ),
  skill("cohesion", "intermediate", {
    description: t(
      "Explain how connectives, pronouns and repetition link the parts of a text.",
      "Explicar como conectivos, pronomes e retomadas ligam as partes de um texto.",
    ),
    name: t("Interpret how texts hold together", "Interpretar mecanismos de coesão textual"),
  }),
  skill("punctuation-syntax", "intermediate", {
    description: t(
      "Explain how punctuation and word order change a sentence's meaning.",
      "Explicar como a pontuação e a ordem das palavras alteram o sentido de uma frase.",
    ),
    name: t(
      "Weigh the effects of punctuation and syntax",
      "Avaliar efeitos da pontuação e sintaxe",
    ),
  }),
  skill(
    "standard-norm",
    "intermediate",
    {
      description: t(
        "Judge whether a text's language suits its situation and the standard norm it calls for.",
        "Avaliar se a linguagem de um texto se adequa à situação e à norma-padrão que ela pede.",
      ),
      name: t("Judge when the standard norm fits", "Julgar a adequação da norma-padrão"),
    },
    { prerequisites: ["language-variation"] },
  ),
  skill(
    "linguistic-prejudice",
    "intermediate",
    {
      description: t(
        "Explain how judging ways of speaking can express prejudice and shape social identities.",
        "Explicar como avaliações de modos de falar podem expressar preconceito e construir identidades sociais.",
      ),
      name: t(
        "Analyze linguistic prejudice and identity",
        "Analisar preconceito linguístico e identidade",
      ),
    },
    { prerequisites: ["language-variation"] },
  ),
  skill("thesis-arguments", "intermediate", {
    description: t(
      "Find the position a text defends and the reasons it gives, in different genres.",
      "Localizar a posição defendida e as razões usadas para sustentá-la em diferentes gêneros.",
    ),
    name: t("Identify thesis and arguments", "Identificar tese e argumentos"),
  }),
  skill(
    "persuasion",
    "intermediate",
    {
      description: t(
        "Recognize how a text tries to convince its reader and judge whether its strategies hold up.",
        "Reconhecer como um texto tenta convencer o leitor e avaliar se suas estratégias se sustentam.",
      ),
      name: t("Weigh persuasive strategies", "Avaliar estratégias persuasivas"),
    },
    { prerequisites: ["thesis-arguments"] },
  ),
  skill(
    "compare-positions",
    "intermediate",
    {
      description: t(
        "Compare the theses and reasons different texts give on the same question.",
        "Comparar teses e justificativas apresentadas em textos sobre uma mesma questão.",
      ),
      name: t("Compare argumentative positions", "Comparar posições argumentativas"),
    },
    { prerequisites: ["thesis-arguments"] },
  ),
  skill(
    "news-ads",
    "intermediate",
    {
      description: t(
        "Tell how news, reports and ads pick information to serve their purpose.",
        "Distinguir como notícias, reportagens e anúncios selecionam informações para cumprir suas finalidades.",
      ),
      name: t(
        "Interpret news and advertising genres",
        "Interpretar gêneros jornalísticos e publicitários",
      ),
    },
    { prerequisites: ["main-idea"] },
  ),
  skill("figures-of-speech", "intermediate", {
    description: t(
      "Explain the meanings metaphors, irony and other expressive resources create in texts.",
      "Explicar os sentidos produzidos por metáforas, ironia e outros recursos expressivos em textos.",
    ),
    name: t("Analyze figures of speech", "Analisar efeitos de figuras de linguagem"),
  }),
  skill(
    "indigenous-afro-brazilian",
    "intermediate",
    {
      description: t(
        "Recognize the role of Indigenous peoples and African and Afro-Brazilian populations in historical and cultural processes.",
        "Reconhecer o protagonismo de povos indígenas e populações africanas e afro-brasileiras em processos históricos e culturais.",
      ),
      name: t(
        "Analyze Indigenous and Afro-Brazilian agency",
        "Analisar o protagonismo indígena e afro-brasileiro",
      ),
    },
    { prerequisites: ["colonial-relations"] },
  ),
  skill(
    "political-ideas",
    "intermediate",
    {
      description: t(
        "Compare ideas about legitimacy, freedom, equality and participation in their historical contexts.",
        "Comparar explicações sobre legitimidade, liberdade, igualdade e participação política em seus contextos históricos.",
      ),
      name: t(
        "Compare political ideas and their contexts",
        "Comparar ideias políticas e seus contextos",
      ),
    },
    { prerequisites: ["coffee-with-milk"] },
  ),
  skill(
    "democratic-institutions",
    "intermediate",
    {
      description: t(
        "Explain how democratic institutions work and how they guarantee citizens' rights.",
        "Explicar como funcionam as instituições democráticas e como garantem os direitos dos cidadãos.",
      ),
      name: t(
        "Analyze democratic institutions and rights",
        "Analisar instituições democráticas e direitos",
      ),
    },
    { prerequisites: ["coffee-with-milk"] },
  ),
  skill("social-movements", "intermediate", {
    description: t(
      "Relate the demands, strategies and gains of social movements to changes in citizenship.",
      "Relacionar reivindicações, estratégias de mobilização e conquistas de movimentos sociais às mudanças na cidadania.",
    ),
    name: t(
      "Analyze social movements and their demands",
      "Analisar movimentos sociais e reivindicações",
    ),
  }),
  skill(
    "industrial-production",
    "intermediate",
    {
      description: t(
        "Identify the changes industrialization brought to production and work.",
        "Identificar as mudanças que a industrialização trouxe para a produção e o trabalho.",
      ),
      name: t(
        "Explain how industrial production changed",
        "Explicar transformações da produção industrial",
      ),
    },
    { prerequisites: ["production-and-labor"] },
  ),
  skill("urbanization", "intermediate", {
    description: t(
      "Relate how cities grow to the inequalities in where people live and the services they reach.",
      "Relacionar o crescimento das cidades às desigualdades de moradia e de acesso a serviços.",
    ),
    name: t(
      "Analyze urbanization and spatial inequality",
      "Analisar urbanização e desigualdades socioespaciais",
    ),
  }),
  skill("water-soil-land-use", "intermediate", {
    description: t(
      "Relate river basins, soils and water supply to how land is settled and used.",
      "Relacionar bacias hidrográficas, solos e disponibilidade de água às formas de ocupação e uso do território.",
    ),
    name: t("Relate water and soil to land use", "Relacionar água e solos à ocupação"),
  }),
  skill(
    "thematic-maps",
    "intermediate",
    {
      description: t(
        "Read spatial distributions and see how projections and map choices change what a map shows.",
        "Interpretar distribuições espaciais e reconhecer como projeções e escolhas cartográficas alteram a representação.",
      ),
      name: t("Interpret thematic maps and projections", "Interpretar mapas temáticos e projeções"),
    },
    { prerequisites: ["map-scale-coordinates"] },
  ),
  skill(
    "essay-repertoire",
    "intermediate",
    {
      description: t(
        "Choose facts, data and references that are relevant to the essay's argument.",
        "Escolher fatos, dados e referências pertinentes à argumentação da redação.",
      ),
      name: t(
        "Pick knowledge that supports the argument",
        "Selecionar repertório pertinente à argumentação",
      ),
    },
    { prerequisites: ["essay-competencies"] },
  ),
  skill(
    "argument-progression",
    "intermediate",
    {
      description: t(
        "Order the essay's arguments so each paragraph builds on the one before.",
        "Ordenar os argumentos da redação para que cada parágrafo avance a partir do anterior.",
      ),
      name: t("Plan how the arguments progress", "Planejar a progressão dos argumentos"),
    },
    { prerequisites: ["essay-repertoire", "essay-competencies"] },
  ),
  skill(
    "gravitation",
    "intermediate",
    {
      description: t(
        "Use gravitation to explain orbits, satellites and astronomical phenomena.",
        "Aplicar a gravitação para explicar órbitas, satélites e fenômenos astronômicos.",
      ),
      name: t("Explain gravitational phenomena", "Explicar fenômenos gravitacionais"),
    },
    { prerequisites: ["newtons-laws"] },
  ),
  skill(
    "magnetism-induction",
    "intermediate",
    {
      description: t(
        "Explain magnetic fields and how a changing field induces a current in generators and transformers.",
        "Explicar campos magnéticos e como um campo variável induz corrente em geradores e transformadores.",
      ),
      name: t("Explain magnetism and induction", "Explicar magnetismo e indução"),
    },
    { prerequisites: ["charges-fields"] },
  ),
  skill(
    "electromagnetic-radiation",
    "intermediate",
    {
      description: t(
        "Tell the bands of the electromagnetic spectrum apart and judge their uses and effects.",
        "Distinguir faixas do espectro eletromagnético e avaliar seus usos e efeitos.",
      ),
      name: t("Weigh electromagnetic radiation", "Avaliar radiações eletromagnéticas"),
    },
    { prerequisites: ["wave-propagation"] },
  ),
  skill(
    "water-treatment",
    "intermediate",
    {
      description: t(
        "Relate separating mixtures, treating water and quality indicators to how safe water is.",
        "Relacionar separação de misturas, tratamento de água e indicadores à qualidade da água.",
      ),
      name: t("Weigh water treatment and quality", "Avaliar tratamento e qualidade da água"),
    },
    { prerequisites: ["aqueous-solutions"] },
  ),
  skill(
    "redox-cells",
    "intermediate",
    {
      description: t(
        "Identify electron transfer and explain how batteries and electrolysis work.",
        "Identificar transferência de elétrons e explicar o funcionamento de pilhas e da eletrólise.",
      ),
      name: t(
        "Explain oxidation, batteries and electrolysis",
        "Explicar oxidação, pilhas e eletrólise",
      ),
    },
    { prerequisites: ["chemical-changes"] },
  ),
  skill(
    "chemical-equilibrium",
    "intermediate",
    {
      description: t(
        "Predict how concentration, temperature and pressure shift a chemical equilibrium.",
        "Prever como concentração, temperatura e pressão deslocam um equilíbrio químico.",
      ),
      name: t(
        "Predict shifts in chemical equilibrium",
        "Prever deslocamentos do equilíbrio químico",
      ),
    },
    { prerequisites: ["chemical-changes"] },
  ),
  skill(
    "organic-reactions-polymers",
    "intermediate",
    {
      description: t(
        "Explain how carbon compounds change and relate polymers to their uses and waste.",
        "Explicar transformações de compostos de carbono e relacionar polímeros às suas aplicações e resíduos.",
      ),
      name: t("Analyze organic reactions and polymers", "Analisar reações orgânicas e polímeros"),
    },
    { prerequisites: ["organic-functions"] },
  ),
  skill(
    "chemical-impacts",
    "intermediate",
    {
      description: t(
        "Weigh the benefits, risks and environmental impact of chemical processes and products.",
        "Avaliar benefícios, riscos e impactos ambientais de processos e produtos químicos.",
      ),
      name: t("Weigh the impacts of chemical processes", "Avaliar impactos de processos químicos"),
    },
    { prerequisites: ["chemical-changes"] },
  ),
  skill(
    "fuels-emissions",
    "intermediate",
    {
      description: t(
        "Compare fuels by their combustion, the energy they release, their uses and their emissions.",
        "Comparar combustíveis pela combustão, energia liberada, aplicações e emissões.",
      ),
      name: t("Compare fuels and emissions", "Comparar combustíveis e emissões"),
    },
    { prerequisites: ["organic-functions", "reaction-energy"] },
  ),
  skill(
    "evolution",
    "intermediate",
    {
      description: t(
        "Explain how variation, natural selection and time lead species to change.",
        "Explicar como variação, seleção natural e tempo levam as espécies a mudar.",
      ),
      name: t("Explain biological evolution", "Explicar a evolução biológica"),
    },
    { prerequisites: ["gene-expression"] },
  ),
  skill(
    "human-physiology",
    "intermediate",
    {
      description: t(
        "Relate how the body's systems work to keeping its inner conditions stable.",
        "Relacionar o funcionamento dos sistemas do corpo à manutenção das condições internas.",
      ),
      name: t("Explain human physiology", "Explicar a fisiologia humana"),
    },
    { prerequisites: ["tissues-organs"] },
  ),
  skill(
    "environmental-cycles",
    "intermediate",
    {
      description: t(
        "Relate the cycles of matter and human activity to changes in ecosystems.",
        "Relacionar ciclos da matéria e atividades humanas a mudanças nos ecossistemas.",
      ),
      name: t("Weigh cycles and environmental impact", "Avaliar ciclos e impactos ambientais"),
    },
    { prerequisites: ["energy-flow"] },
  ),
  skill(
    "disease-prevention",
    "intermediate",
    {
      description: t(
        "Relate how diseases spread to the vaccines, sanitation and habits that prevent them.",
        "Relacionar a transmissão de doenças às vacinas, ao saneamento e aos hábitos que as previnem.",
      ),
      name: t("Weigh disease prevention", "Avaliar a prevenção de doenças"),
    },
    { prerequisites: ["groups-of-living-beings"] },
  ),
  skill(
    "biotechnology",
    "intermediate",
    {
      description: t(
        "Interpret the uses and limits of genetic tests, genetic engineering and other biotechnologies.",
        "Interpretar aplicações e limites de testes genéticos, engenharia genética e outras biotecnologias.",
      ),
      name: t("Weigh uses of biotechnology", "Avaliar aplicações da biotecnologia"),
    },
    { prerequisites: ["gene-expression"] },
  ),
  skill(
    "plane-transformations",
    "intermediate",
    {
      description: t(
        "Recognize symmetry, translation, rotation and scaling and how they change plane figures.",
        "Reconhecer simetrias, translações, rotações e ampliações e determinar como alteram figuras planas.",
      ),
      name: t("Analyze transformations in the plane", "Analisar transformações no plano"),
    },
    { prerequisites: ["similar-figures"] },
  ),
  skill(
    "exponential-log-functions",
    "intermediate",
    {
      description: t(
        "Recognize exponential growth and decay and use logarithms to read scales and find values.",
        "Reconhecer crescimento e decaimento exponenciais e usar logaritmos para interpretar escalas e determinar valores.",
      ),
      name: t(
        "Analyze exponential and logarithmic functions",
        "Analisar funções exponenciais e logarítmicas",
      ),
    },
    { prerequisites: ["function-representations", "powers-magnitudes"] },
  ),
  skill(
    "cartesian-lines",
    "intermediate",
    {
      description: t(
        "Find distances, midpoints and how lines relate on the Cartesian plane from coordinates and equations.",
        "Determinar distâncias, pontos médios e relações entre retas no plano cartesiano a partir de coordenadas e equações.",
      ),
      name: t(
        "Analyze points and lines on the Cartesian plane",
        "Analisar pontos e retas cartesianas",
      ),
    },
    { prerequisites: ["linear-function", "triangles"] },
  ),
  skill(
    "cartesian-circles",
    "intermediate",
    {
      description: t(
        "Relate a circle's center, radius and equation to where points lie on the plane.",
        "Relacionar centro, raio e equação de uma circunferência para avaliar posições de pontos no plano.",
      ),
      name: t(
        "Analyze circles on the Cartesian plane",
        "Analisar circunferências no plano cartesiano",
      ),
    },
    { prerequisites: ["cartesian-lines"] },
  ),
  skill(
    "algebraic-geometric-models",
    "intermediate",
    {
      description: t(
        "Express area, perimeter or position constraints as equations and functions to compare geometric solutions.",
        "Expressar restrições de área, perímetro ou posição por equações e funções para comparar soluções geométricas.",
      ),
      name: t("Model algebraic and geometric problems", "Modelar problemas algébrico-geométricos"),
    },
    { prerequisites: ["perimeters-areas", "quadratic-function"] },
  ),
  skill(
    "literature-society",
    "intermediate",
    {
      description: t(
        "Relate the themes and perspectives of literary texts to the social conditions they were written in.",
        "Relacionar temas e perspectivas de textos literários às condições sociais de sua produção.",
      ),
      name: t("Relate literature to its social context", "Relacionar literatura e contexto social"),
    },
    { prerequisites: ["texts-in-context"] },
  ),
  skill("narrative-poetry", "intermediate", {
    description: t(
      "Explain how narrator, time, rhythm and imagery build meaning in stories and poems.",
      "Explicar como narrador, tempo, ritmo e imagens constroem sentidos em narrativas e poemas.",
    ),
    name: t(
      "Analyze how narratives and poems are built",
      "Analisar construção narrativa e poética",
    ),
  }),
  skill("artistic-representations", "intermediate", {
    description: t(
      "Interpret how paintings, music, films and other art forms represent the world.",
      "Interpretar como pinturas, músicas, filmes e outras artes representam o mundo.",
    ),
    name: t("Interpret artistic representations", "Interpretar representações artísticas"),
  }),
  skill("body-practices", "intermediate", {
    description: t(
      "Relate sports, dances and other body practices to the groups and identities they express.",
      "Relacionar esportes, danças e outras práticas corporais aos grupos e identidades que expressam.",
    ),
    name: t("Relate body practices to identities", "Relacionar práticas corporais e identidades"),
  }),
  skill("digital-technology", "intermediate", {
    description: t(
      "Analyze how digital technologies change how people communicate, work and get information.",
      "Analisar como as tecnologias digitais mudam o modo de comunicar, trabalhar e se informar.",
    ),
    name: t(
      "Analyze social uses of digital technology",
      "Analisar usos sociais das tecnologias digitais",
    ),
  }),
  skill(
    "digital-genres",
    "intermediate",
    {
      description: t(
        "Identify how digital platforms shape how texts are produced and shared.",
        "Identificar como recursos de plataformas digitais moldam a produção e a circulação de textos.",
      ),
      name: t("Interpret digital genres", "Interpretar gêneros digitais"),
    },
    { prerequisites: ["main-idea"] },
  ),
  skill(
    "media-representations",
    "intermediate",
    {
      description: t(
        "Compare how visual, sound and verbal languages represent a theme in different media.",
        "Comparar como linguagens visuais, sonoras e verbais representam um tema em diferentes mídias.",
      ),
      name: t("Compare representations across media", "Comparar representações entre mídias"),
    },
    { prerequisites: ["artistic-representations"] },
  ),
  skill(
    "intertextuality",
    "intermediate",
    {
      description: t(
        "Recognize references to and recreations of other texts and explain the meanings they create.",
        "Reconhecer referências e recriações de outros textos e explicar seus efeitos de sentido.",
      ),
      name: t("Explain the effects of intertextuality", "Explicar efeitos da intertextualidade"),
    },
    { prerequisites: ["inference"] },
  ),
  skill(
    "racism-inequality",
    "intermediate",
    {
      description: t(
        "Relate racism and inequality today to the historical processes that produced them.",
        "Relacionar o racismo e as desigualdades atuais aos processos históricos que os produziram.",
      ),
      name: t(
        "Analyze racism and historical inequality",
        "Analisar racismo e desigualdades históricas",
      ),
    },
    { prerequisites: ["indigenous-afro-brazilian", "colonial-relations"] },
  ),
  skill("migration-conflicts", "intermediate", {
    description: t(
      "Explain population movements through conflict, work, persecution and differences between places.",
      "Explicar deslocamentos populacionais a partir de conflitos, trabalho, perseguições e diferenças entre territórios.",
    ),
    name: t("Explain migration and social conflict", "Explicar migrações e conflitos sociais"),
  }),
  skill(
    "democracy-authoritarianism",
    "intermediate",
    {
      description: t(
        "Tell authoritarian practices from democratic ways of taking part, checking power and guaranteeing rights.",
        "Distinguir práticas autoritárias de mecanismos democráticos de participação, controle do poder e garantia de direitos.",
      ),
      name: t("Tell democracy from authoritarianism", "Distinguir democracia e autoritarismo"),
    },
    { prerequisites: ["democratic-institutions"] },
  ),
  skill(
    "public-policy",
    "intermediate",
    {
      description: t(
        "Judge public policies by the problems they address and the effects they have on people.",
        "Avaliar políticas públicas pelos problemas que enfrentam e pelos efeitos que têm sobre as pessoas.",
      ),
      name: t(
        "Weigh public policies and their effects",
        "Avaliar políticas públicas e seus efeitos",
      ),
    },
    { prerequisites: ["democratic-institutions"] },
  ),
  skill(
    "geopolitics",
    "intermediate",
    {
      description: t(
        "Explain conflicts between countries and blocs over territory, resources and influence.",
        "Explicar disputas entre países e blocos por território, recursos e influência.",
      ),
      name: t("Analyze geopolitical disputes", "Analisar disputas geopolíticas"),
    },
    { prerequisites: ["coffee-with-milk"] },
  ),
  skill(
    "global-production",
    "intermediate",
    {
      description: t(
        "Relate global production chains, trade and changes in work to economic inequality.",
        "Relacionar cadeias globais de produção, circulação de mercadorias e mudanças no trabalho às desigualdades econômicas.",
      ),
      name: t("Analyze globalized production", "Analisar a produção globalizada"),
    },
    { prerequisites: ["industrial-production"] },
  ),
  skill(
    "environmental-degradation",
    "intermediate",
    {
      description: t(
        "Explain the effects of deforestation, farming expansion and urban growth on natural domains.",
        "Explicar efeitos do desmatamento, da expansão agropecuária e da ocupação urbana sobre os domínios naturais.",
      ),
      name: t("Explain environmental degradation", "Explicar processos de degradação ambiental"),
    },
    { prerequisites: ["natural-domains"] },
  ),
  skill("resources-energy", "intermediate", {
    description: t(
      "Compare uses of minerals and energy sources by their impact on land and the interests in conflict.",
      "Comparar usos de recursos minerais e fontes de energia considerando impactos territoriais e conflitos de interesse.",
    ),
    name: t("Compare uses of resources and energy", "Comparar usos de recursos e energia"),
  }),
  skill(
    "climate-responses",
    "intermediate",
    {
      description: t(
        "Judge conservation proposals and responses to climate change by their environmental and social effects.",
        "Avaliar propostas de conservação e respostas às mudanças climáticas segundo seus efeitos ambientais e sociais.",
      ),
      name: t("Weigh responses to the environmental crisis", "Avaliar respostas à crise ambiental"),
    },
    { prerequisites: ["environmental-degradation"] },
  ),
  skill(
    "essay-introduction",
    "intermediate",
    {
      description: t(
        "Open the essay by presenting the topic and stating the thesis it will defend.",
        "Abrir a redação apresentando o tema e afirmando a tese que será defendida.",
      ),
      name: t("Write an introduction with a thesis", "Redigir uma introdução com tese"),
    },
    { prerequisites: ["essay-competencies"] },
  ),
  skill(
    "evidence-arguments",
    "intermediate",
    {
      description: t(
        "Support each argument with data, examples or references and explain how they prove the point.",
        "Sustentar cada argumento com dados, exemplos ou referências e explicar como eles comprovam o ponto.",
      ),
      name: t(
        "Develop arguments backed by evidence",
        "Desenvolver argumentos sustentados por evidências",
      ),
    },
    { prerequisites: ["argument-progression"] },
  ),
  skill(
    "essay-standard-norm",
    "intermediate",
    {
      description: t(
        "Fix agreement, government, punctuation and word-choice slips that break the standard norm.",
        "Corrigir desvios de concordância, regência, pontuação e escolha vocabular que prejudiquem a norma-padrão do texto.",
      ),
      name: t("Revise the essay's standard norm", "Revisar a norma-padrão da redação"),
    },
    { prerequisites: ["essay-introduction", "evidence-arguments"] },
  ),
  skill(
    "timed-essay",
    "intermediate",
    {
      description: t(
        "Plan, write and review a full essay within the exam's time.",
        "Planejar, escrever e revisar uma redação completa dentro do tempo da prova.",
      ),
      name: t("Write a complete essay in time", "Produzir uma redação completa sob tempo"),
    },
    { prerequisites: ["essay-standard-norm", "intervention-proposal", "essay-conclusion"] },
  ),
  skill("exam-time", "intermediate", {
    description: t(
      "Split the time between the questions and the essay, leaving room to come back to hard questions and check answers.",
      "Distribuir o tempo entre questões objetivas e redação, deixando espaço para retomar questões difíceis e conferir as respostas.",
    ),
    name: t("Manage time in the ENEM papers", "Gerenciar o tempo nas provas do ENEM"),
  }),
  skill("choosing-answers", "intermediate", {
    description: t(
      "Rule out options by the question's command and the text's evidence before picking one.",
      "Descartar alternativas pelo comando da questão e pelas evidências do texto antes de escolher uma.",
    ),
    name: t("Choose between ENEM's options", "Decidir entre alternativas nas questões do ENEM"),
  }),
  // The foreign language each candidate picks, one skill per option, as the graph's coverage
  // check adds them for the notice's subjects the graph left out.
  skill("english-reading", "intermediate", {
    description: t(
      "Find the theme, the purpose and the key information of a short English text, from its words and its genre.",
      "Identificar o tema, a finalidade e as informações principais de um texto curto em inglês, pelas palavras e pelo gênero.",
    ),
    name: t("Read English texts for ENEM", "Ler textos em inglês no ENEM"),
  }),
  skill("spanish-reading", "intermediate", {
    description: t(
      "Find the theme, the purpose and the key information of a short Spanish text, from its words and its genre.",
      "Identificar o tema, a finalidade e as informações principais de um texto curto em espanhol, pelas palavras e pelo gênero.",
    ),
    name: t("Read Spanish texts for ENEM", "Ler textos em espanhol no ENEM"),
  }),
];
