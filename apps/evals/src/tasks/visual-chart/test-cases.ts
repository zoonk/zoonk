const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. CHART TYPE: The chartType must match the data structure. Use "bar" for category comparisons, "line" for trends over a continuous dimension, "pie" for proportions summing to 100%. Penalize mismatched types (e.g., "pie" for data that doesn't sum to 100%).

2. DATA ACCURACY: Data points must faithfully reflect the VISUAL_DESCRIPTION. If the description gives specific values, use them exactly. If the description is qualitative (e.g., "rises then falls"), illustrative values are expected — but they must match the described pattern. Do NOT add extra data points beyond what the description specifies.

3. TITLE: Must be concise (max 50 chars), descriptive, and in the correct language.

4. LANGUAGE: All text content (title, data point names) must be in the specified language. Only JSON field names and enum values should be in English.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-bar-regional-latency",
    userInput: {
      description:
        "Bar chart comparing average page load times across four regions: US East (1.2s), US West (1.4s), Europe (3.8s), Asia (2.1s). Title: 'Page Load by Region'. The Europe bar should stand out as the slowest.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-line-cpu-usage-over-time",
    userInput: {
      description:
        "Line chart showing CPU usage over 6 hours: starts at 45% at 8:00, gradually rises to 72% at 11:00, drops sharply to 30% at 12:00, then climbs back to 65% by 14:00. Title: 'CPU Usage During Incident'.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-pie-error-distribution",
    userInput: {
      description:
        "Pie chart showing the distribution of error types in a web application: Timeout errors (45%), Connection refused (30%), SSL handshake failures (15%), DNS resolution (10%). Title: 'Error Type Breakdown'.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "pt-bar-vendas-por-loja",
    userInput: {
      description:
        "Gráfico de barras comparando vendas trimestrais de 5 lojas: Loja Centro (R$ 450 mil), Loja Sul (R$ 320 mil), Loja Norte (R$ 280 mil), Loja Oeste (R$ 510 mil), Loja Leste (R$ 390 mil). Título: 'Vendas por Loja — T3'.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "es-line-temperatura-reactor",
    userInput: {
      description:
        "Gráfico de línea mostrando la temperatura de un reactor durante 8 horas: empieza en 120°C a las 6:00, sube gradualmente a 185°C a las 10:00, se mantiene estable hasta las 12:00, y luego baja a 95°C a las 14:00. Título: 'Temperatura del Reactor'.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-bar-qualitative-performance",
    userInput: {
      description:
        "Bar chart showing query performance across different database indexes. The description says: 'B-tree index is fastest, hash index is slightly slower, and full table scan is dramatically slower.' No exact numbers given — illustrative values expected.",
      language: "en",
    },
  },
];
