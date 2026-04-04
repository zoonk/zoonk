const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STRUCTURE: Every row must have exactly one value per column — the number of values in each row must match the number of columns. Missing fields make the table malformed.

2. DATA ACCURACY: Column headers and cell values must faithfully reflect the VISUAL_DESCRIPTION. If the description gives specific column names and values, use those. If the description is qualitative, illustrative values are expected but must match the described pattern.

3. ALL VALUES ARE STRINGS: Cell values must be strings (e.g., "42" not 42), even for numeric data.

4. CAPTION: Optional but should be included when the description provides context for the table. Max 100 characters.

5. LANGUAGE: All text content (column headers, cell values, caption) must be in the specified language. Only JSON field names should be in English.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-client-scores-errors",
    userInput: {
      description:
        "Table with columns: Client, Score, Status. Rows: 'Acme Corp' / inf / Error, 'Beta Inc' / nan / Error, 'Gamma Ltd' / 87.3 / OK, 'Delta Co' / (blank) / Missing. Note: ordering changes on page reload.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-http-status-codes",
    userInput: {
      description:
        "Table comparing HTTP response codes from 5 endpoints: /api/users returns 200, /api/orders returns 200, /api/payments returns 500, /api/search returns 404, /api/health returns 200. Columns: Endpoint, Status Code, Response Time (ms). Add plausible response times.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-before-after-comparison",
    userInput: {
      description:
        "Table comparing before and after metrics for a database optimization: Query A went from 1200ms to 45ms, Query B from 800ms to 120ms, Query C from 3500ms to 200ms, Query D stayed the same at 50ms. Columns: Query, Before (ms), After (ms), Improvement.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "pt-resultados-testes",
    userInput: {
      description:
        "Tabela com resultados de testes de qualidade de um produto alimentício. Colunas: Amostra, pH, Temperatura (°C), Resultado. Linhas: Amostra 1 / 4.2 / 22 / Aprovado, Amostra 2 / 6.8 / 35 / Reprovado, Amostra 3 / 4.5 / 20 / Aprovado, Amostra 4 / 7.1 / 40 / Reprovado. Legenda: 'Testes de controle de qualidade — Lote 47'.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "es-comparacion-servidores",
    userInput: {
      description:
        "Tabla comparando tres servidores de base de datos: PostgreSQL, MySQL y MongoDB. Columnas: Característica, PostgreSQL, MySQL, MongoDB. Filas: Tipo (Relacional, Relacional, Documento), Transacciones ACID (Sí, Sí, Parcial), Escalabilidad horizontal (Limitada, Limitada, Nativa), Esquema (Estricto, Estricto, Flexible).",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-qualitative-investigation-findings",
    userInput: {
      description:
        "Table showing investigation test results for a network issue. The description says: 'Traceroute from affected region shows extra hops through an intermediate city, packet loss varies between 2% and 15% across tests, while traceroute from unaffected region shows direct path with no packet loss.' Columns: Test, Affected Region, Unaffected Region.",
      language: "en",
    },
  },
];
