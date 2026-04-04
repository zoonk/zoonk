const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. CHRONOLOGICAL ORDER: Events must be in chronological order — earliest first.

2. EVENT ACCURACY: Events must faithfully reflect the VISUAL_DESCRIPTION. If the description specifies dates and event names, use those. Do not add extra events beyond what the description specifies.

3. CONSTRAINTS: Title max 50 characters, description max 150 characters per event. Dates can be approximate ("Early 2000s", "Mid-20th century").

4. LANGUAGE: All text content (dates, titles, descriptions) must be in the specified language. Only JSON field names should be in English.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-incident-timeline",
    userInput: {
      description:
        "Timeline of a production incident: 9:15 AM — first user reports of slow pages; 9:30 AM — monitoring alerts fire for high latency in EU region; 9:45 AM — team identifies network path issue through intermediate hop; 10:00 AM — ISP contacted about routing anomaly; 10:30 AM — ISP reroutes traffic, latency returns to normal; 11:00 AM — incident postmortem begins.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-vaccination-campaign",
    userInput: {
      description:
        "Timeline of a national vaccination campaign: January 2021 — first batch of vaccines approved; March 2021 — distribution to major urban centers begins; June 2021 — rural distribution starts but faces cold chain challenges; September 2021 — 50% of population receives first dose; December 2021 — booster campaign announced.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "pt-evolucao-sistema",
    userInput: {
      description:
        "Linha do tempo da evolução de um sistema de pagamentos: 2018 — Sistema monolítico lançado com pagamento via boleto; 2019 — Adicionado pagamento por cartão de crédito; 2020 — Migração para microsserviços iniciada; 2021 — Integração com PIX implementada; 2023 — Sistema completamente migrado para arquitetura de eventos.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "es-historia-internet",
    userInput: {
      description:
        "Línea de tiempo de hitos clave de Internet: 1969 — ARPANET establece la primera conexión; 1983 — TCP/IP se convierte en el estándar; 1991 — Tim Berners-Lee presenta la World Wide Web; 1998 — Google es fundado; 2004 — Facebook se lanza desde Harvard.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-approximate-dates",
    userInput: {
      description:
        "Timeline of the development of programming paradigms: Late 1950s — first procedural languages emerge (Fortran, COBOL); Early 1970s — structured programming gains traction; Mid-1980s — object-oriented programming becomes mainstream; Late 1990s — functional programming sees renewed interest; 2010s — concurrent and reactive paradigms rise.",
      language: "en",
    },
  },
];
