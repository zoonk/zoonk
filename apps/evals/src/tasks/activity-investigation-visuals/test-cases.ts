const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. KIND APPROPRIATENESS: Choose kind based on data structure. Code/logs -> "code". Numeric trends -> "chart". Structured data -> "table". Systems/flows -> "diagram". Physical scenes -> "image" (last resort). Penalize "image" when a structured type fits.

2. DESCRIPTION SPECIFICITY: Descriptions must be specific enough for a visual generation system — include data values for charts, column headers for tables, code structure for snippets, node labels for diagrams. When content is qualitative (e.g., "values rise then fall"), the description should invent plausible illustrative values that match the described pattern — the visual is an illustration, not a data source. Penalize vague descriptions like "a relevant chart." For tables, every row must have exactly one value per column — missing fields make the data malformed.

3. CONSISTENCY: Visual descriptions must reflect the same evidence as the input content. If the content mentions specific data, the visual should show that data. Do NOT penalize plausible illustrative values added to make qualitative content generatable — that is expected. DO penalize descriptions that add speculative mechanisms or conclusions not present in the content (e.g., inventing a specific cause when the content only describes symptoms).

4. LANGUAGE: Visual descriptions should use the content language where applicable.
`;

// ---------------------------------------------------------------------------
// Scenario visual test cases (7)
// ---------------------------------------------------------------------------

const SCENARIO_EN_WEB =
  "Your team's web app suddenly feels slow for users in one region, even though the servers look healthy and CPU use is normal. You need to figure out why pages are taking several extra seconds to load before support starts rolling back unrelated changes.";

const SCENARIO_PT_PYTHON =
  "Você foi chamado porque o sistema de risco de uma fintech aprovou alguns pedidos que deveriam ter sido bloqueados e, ao mesmo tempo, marcou outros como impossíveis de avaliar. Nos relatórios da madrugada, várias colunas aparecem com números sem sentido, campos vazios e alertas contraditórios.";

const SCENARIO_ES_QUIMICA =
  "Estás revisando una corrida en la planta y el lote salió con muy poco producto útil y demasiadas impurezas. El procedimiento parecía rutinario, pero esta vez aparecieron compuestos inesperados y nadie sabe en qué paso se torció todo.";

const SCENARIO_EN_ECONOMICS =
  "You run strategy for a retail chain that opened 18 new stores after a strong first half of the year. By early fall, sales are sliding, inventory is piling up, and the new locations are missing their targets even in cities that looked promising.";

const SCENARIO_PT_AGILE =
  "Você faz parte da equipe de um produto que ficou anos crescendo sem parar, e agora os erros aumentaram sempre que uma compra passa por etapas específicas do fluxo. O site continua no ar, mas cada ajuste parece consertar um pedaço e quebrar outro, e você precisa descobrir o que realmente está acontecendo sem parar a operação.";

const SCENARIO_EN_HISTORY =
  "You're advising officials as a new disease spreads, but the national vaccination campaign keeps falling behind schedule. Some regions are waiting for doses while others get shipments late, and you need to figure out why the country couldn't respond faster.";

const SCENARIO_EN_ENGINEERING =
  "You've been called to inspect a century-old stone building after residents reported new cracks appearing on upper floors. The building passed its last inspection two years ago, no renovations were done since, and neighboring buildings of similar age show no problems.";

export const TEST_CASES = [
  // --- Scenario visuals ---
  {
    expectations: SHARED_EXPECTATIONS,
    id: "scenario-en-web-packets-network-paths",
    userInput: { language: "en", scenario: SCENARIO_EN_WEB },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "scenario-pt-python-inf-nan",
    userInput: { language: "pt", scenario: SCENARIO_PT_PYTHON },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "scenario-es-quimica-alquilacion-alfa",
    userInput: { language: "es", scenario: SCENARIO_ES_QUIMICA },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "scenario-en-economics-business-cycle-phases",
    userInput: { language: "en", scenario: SCENARIO_EN_ECONOMICS },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "scenario-pt-agile-transformacao-gradual",
    userInput: { language: "pt", scenario: SCENARIO_PT_AGILE },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "scenario-en-history-biomedical-institutions",
    userInput: { language: "en", scenario: SCENARIO_EN_HISTORY },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "scenario-en-engineering-structural-diagnosis",
    userInput: { language: "en", scenario: SCENARIO_EN_ENGINEERING },
  },

  // --- Finding visuals: broad coverage (one per activity) ---
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-web-path-checks",
    userInput: {
      finding:
        "Path checks from the slow region pass through several extra network hops before reaching the app, including one stop in another city. However, the number of hops stays the same across repeated tests even when the delay jumps up and down by several seconds.",
      language: "en",
      scenario: SCENARIO_EN_WEB,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "finding-pt-python-data-pipeline",
    userInput: {
      finding:
        "Ao seguir o caminho dos dados, os valores já saem da leitura inicial com diferenças de formato entre colunas parecidas, e em uma etapa intermediária alguns campos passam a aparecer como número comum mesmo quando vieram vazios. No entanto, em outras linhas o valor original continua visível até quase o fim e o problema só aparece no fechamento do relatório.",
      language: "pt",
      scenario: SCENARIO_PT_PYTHON,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "finding-es-quimica-molecule-positions",
    userInput: {
      finding:
        "En el dibujo del compuesto de partida hay dos posiciones muy parecidas donde podía ocurrir el cambio, y en los antecedentes del proceso ya se habían reportado mezclas pequeñas de dos variantes. Sin embargo, en las corridas buenas esas variantes quedaban en niveles bajos y esta vez la proporción entre ellas salió mucho más desordenada.",
      language: "es",
      scenario: SCENARIO_ES_QUIMICA,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-economics-first-half-boost",
    userInput: {
      finding:
        "The first half included a holiday shift that pushed seasonal purchases earlier than usual, and several regions also saw one-time jumps during a short stretch of unusually strong foot traffic. However, some of the cities where those boosts were largest still held up reasonably well into midsummer before dropping later.",
      language: "en",
      scenario: SCENARIO_EN_ECONOMICS,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "finding-pt-agile-status-divergence",
    userInput: {
      finding:
        "Ao conferir o mesmo pedido em telas e consultas diferentes, em vários casos o status aparece como concluído em um lugar e como pendente em outro por alguns minutos. No entanto, há pedidos com erro em que todas as partes mostram exatamente o mesmo status do começo ao fim.",
      language: "pt",
      scenario: SCENARIO_PT_AGILE,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-history-material-transfer",
    userInput: {
      finding:
        "Transfer logs show samples, paperwork, and equipment requests moving through multiple offices before reaching factories or clinics. However, some urgent messages were answered the same day, and a few regions received materials without the full reporting trail being completed first.",
      language: "en",
      scenario: SCENARIO_EN_HISTORY,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-economics-competitor-cities",
    userInput: {
      finding:
        "In 7 of the 18 new-store cities, a national competitor opened a new location or started heavy discounting within a few weeks of your launch. However, the remaining new-store cities had no major competitor change on record and still showed a similar sales slide over the same period.",
      language: "en",
      scenario: SCENARIO_EN_ECONOMICS,
    },
  },

  // --- Cross-context stress test: multiple chart findings from web networking ---
  // All 4 picked "chart" in the batch approach with differentiated subtypes.
  // Without cross-finding context, will the model still pick distinct chart designs?
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-web-timing-breakdown",
    userInput: {
      finding:
        "A timing breakdown shows the browser connects quickly and the app starts generating the page in its usual time. However, there is a long gap while data is being exchanged after the first response bytes appear, and that gap is much larger only for users in the affected region.",
      language: "en",
      scenario: SCENARIO_EN_WEB,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-web-dropped-packets",
    userInput: {
      finding:
        "Records from devices on that route show bursts of dropped packets and a rising count of delayed retransmissions during the same hours users reported slow pages. However, the logs also show stretches with no unusual drops while test loads from the region still take much longer than normal.",
      language: "en",
      scenario: SCENARIO_EN_WEB,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-web-page-size-scatter",
    userInput: {
      finding:
        "Page-load tests from cities near the affected region are slow by several extra seconds, while tests from other regions finish near the usual time. However, the slow tests do not fail outright, and small pages often load much closer to normal than larger ones.",
      language: "en",
      scenario: SCENARIO_EN_WEB,
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "finding-en-web-server-metrics",
    userInput: {
      finding:
        "The busy app server shows normal CPU use, stable memory, and response times close to its usual baseline during the slowdown window. However, one short period shows its request queue briefly growing even though users in unaffected regions were still getting normal page loads at that time.",
      language: "en",
      scenario: SCENARIO_EN_WEB,
    },
  },

  // --- Image kind test: physical scene findings from structural diagnosis ---
  {
    expectations: `${SHARED_EXPECTATIONS}
IMAGE KIND: This finding describes a physical scene (visible cracks in stone) that can only be represented as a photograph. It SHOULD use "image" kind. Penalize using a structured type when the evidence is inherently a physical scene.
    `,
    id: "finding-en-engineering-wall-cracks",
    userInput: {
      finding:
        "Several new cracks on the upper floors run diagonally from window corners toward the ceiling, and the crack edges show fresh, light-colored stone with no weathering or staining. However, a few older hairline cracks on the same walls have similar diagonal angles and were marked as stable in the previous inspection report.",
      language: "en",
      scenario: SCENARIO_EN_ENGINEERING,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
IMAGE KIND: This finding describes a physical scene (damp, eroded foundation stones) that can only be represented as a photograph. It SHOULD use "image" kind. Penalize using a structured type when the evidence is inherently a physical scene.
    `,
    id: "finding-en-engineering-foundation-stones",
    userInput: {
      finding:
        "The exposed foundation stones on the east side show a dark, damp band running along the base about one foot high, with soft powdery patches where the stone surface has eroded. However, the west side foundation also has some damp patches at a lower height, and those stones appear firm to the touch.",
      language: "en",
      scenario: SCENARIO_EN_ENGINEERING,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
IMAGE KIND: This finding describes a physical scene (crumbling mortar joints) that can only be represented as a photograph. It SHOULD use "image" kind. Penalize using a structured type when the evidence is inherently a physical scene.
    `,
    id: "finding-en-engineering-mortar-joints",
    userInput: {
      finding:
        "Mortar between stones on the third and fourth floors crumbles easily when scraped with a pocket knife, and several joints have gaps wide enough to insert a fingertip. However, mortar samples from the ground floor and basement walls resist scraping and show no visible gaps, even in the same structural bay.",
      language: "en",
      scenario: SCENARIO_EN_ENGINEERING,
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
IMAGE KIND: This finding describes a physical scene (discolored stone and wet soil) that can only be represented as a photograph. It SHOULD use "image" kind. Penalize using a structured type when the evidence is inherently a physical scene.
    `,
    id: "finding-en-engineering-water-staining",
    userInput: {
      finding:
        "A broad area of discolored stone and mineral deposits runs down the east exterior wall from the roofline gutter, and the soil at the base of that wall stays visibly wetter than soil on the other sides even during dry weather. However, interior moisture readings on the east wall are only slightly above those on the north wall, which shows no exterior staining.",
      language: "en",
      scenario: SCENARIO_EN_ENGINEERING,
    },
  },
];
