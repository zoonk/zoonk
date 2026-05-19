const SHARED_EXPECTATIONS = `
  - Must return concise database search strings in the "queries" array
  - Must add supplemental recall beyond the proposed title because the resolver already searches the exact title and slug by default
  - Must include terms that maximize recall for the same course identity
  - Must prefer small distinctive terms over alternate-title-shaped phrases
  - Must include useful roots, morphology variants, translations, synonyms, abbreviations, and canonical names when they apply
  - Must not include the exact proposed title as a query
  - Must not include unrelated sibling fields, generic words, or broad umbrella topics unless the proposed course is broad
  - Must not pad the list with weak, loosely related, or merely adjacent topics
`;

export const TEST_CASES = [
  {
    expectations: `
      - Must include "frontend" and "front end"
      - Could include "front-end"
      - Must not include exact "frontend engineering"
      - Must not include broad "web development"
      - Must not include generic "engineering" or "development" by itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-engineering",
    userInput: {
      suggestion: {
        description: "Build client-side product interfaces.",
        language: "en",
        targetLanguage: null,
        title: "Frontend Engineering",
      },
    },
  },
  {
    expectations: `
      - Must include "frontend" and "front end"
      - Could include "front-end"
      - Must not include exact "client side development"
      - Must not include generic "development" by itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-client-side-development",
    userInput: {
      suggestion: {
        description: "Build browser-based interfaces for product experiences.",
        language: "en",
        targetLanguage: null,
        title: "Client Side Development",
      },
    },
  },
  {
    expectations: `
      - Must include "python"
      - Must not include exact "python for data science"
      - Should not include "python programming" because "python" already matches that title
      - Must not return "data science" without Python as the main duplicate signal

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-python-for-data-science",
    userInput: {
      suggestion: {
        description: "Use Python to analyze data and build practical models.",
        language: "en",
        targetLanguage: null,
        title: "Python for Data Science",
      },
    },
  },
  {
    expectations: `
      - Must include "machine learning"
      - Must include "ML"
      - Should include "aprendizagem de máquina"
      - Must not include exact "aprendizado de máquina"

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-aprendizado-de-maquina",
    userInput: {
      suggestion: {
        description: "Modelos que aprendem com dados.",
        language: "pt",
        targetLanguage: null,
        title: "Aprendizado de máquina",
      },
    },
  },
  {
    expectations: `
      - Must include "english" or "inglês"
      - Should include "english proficiency" or "proficiência em inglês"
      - Must not include exact "TOEFL"
      - Must not include generic exam-prep queries that omit English

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-toefl-english",
    userInput: {
      suggestion: {
        description: "Preparação para uma prova de proficiência em inglês.",
        language: "pt",
        targetLanguage: "en",
        title: "TOEFL",
      },
    },
  },
  {
    expectations: `
      - Must include "mandarin"
      - Must include "chinese"
      - Must include Simplified Chinese and Traditional Chinese names such as "中文", "汉语", "漢語", "普通话", or "普通話"
      - Must include "HSK" or "Hanyu Shuiping Kaoshi"
      - Must not include exact "mandarin chinese"
      - Must not stop at eight queries when more strong Chinese-language variants are relevant
      - Must not include unrelated Asian languages such as Japanese or Korean

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-mandarin-chinese",
    userInput: {
      suggestion: {
        description:
          "Learn Mandarin Chinese pronunciation, characters, and everyday communication.",
        language: "en",
        targetLanguage: "zh",
        title: "Mandarin Chinese",
      },
    },
  },
  {
    expectations: `
      - Must include "formula 1" and "formula one"
      - Must not include exact "F1"
      - Must not include unrelated formula/math queries

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-f1",
    userInput: {
      suggestion: {
        description: "Teams, drivers, strategy, and race weekends.",
        language: "en",
        targetLanguage: null,
        title: "F1",
      },
    },
  },
  {
    expectations: `
      - Must include "c++"
      - Must include "cpp" and "c plus plus"
      - Must not include exact "c++ programming"
      - Must not include "c" by itself or "c programming"
      - Must not include generic "programming" by itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-c-plus-plus-programming",
    userInput: {
      suggestion: {
        description: "Learn modern C++ syntax, memory, and standard library fundamentals.",
        language: "en",
        targetLanguage: null,
        title: "C++ Programming",
      },
    },
  },
  {
    expectations: `
      - Must include "california law"
      - Should include "california legal system" and "california legal"
      - Must preserve the California jurisdiction
      - Must not include exact "CA law"
      - Must not include "brazilian law" or jurisdiction-free "law" as a likely duplicate

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ca-law",
    userInput: {
      suggestion: {
        description: "Legal systems and rules in California.",
        language: "en",
        targetLanguage: null,
        title: "CA Law",
      },
    },
  },
];
