const SHARED_EXPECTATIONS = `
  - Must return concise database search strings in the "queries" array
  - Must include terms that maximize recall for the same course identity
  - Must prefer small distinctive terms over alternate-title-shaped phrases
  - Must include useful roots, morphology variants, translations, synonyms, abbreviations, and canonical names when they apply
  - Must not include unrelated sibling fields, generic words, or broad umbrella topics unless the proposed course is broad
  - Must return at most 8 queries
`;

export const TEST_CASES = [
  {
    expectations: `
      - Must include "frontend" or "front end"
      - Should include "client side", "ui", or "interface"
      - Should not rely only on full phrases like "frontend engineering" or "frontend development"
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
      - Must include "python"
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
      - Must include "aprendizado de máquina"
      - Must include "machine learning"
      - Should include "aprendizagem de máquina" or "ML"

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
      - Must include "TOEFL"
      - Should include another English proficiency signal like "IELTS" only if it still points to English
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
      - Must include "formula 1"
      - Must include "F1"
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
      - Must include "react"
      - Should include "react.js" or "reactjs"
      - Must not include broad "javascript" as a replacement for React

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-react",
    userInput: {
      suggestion: {
        description: "Build interfaces with React.",
        language: "en",
        targetLanguage: null,
        title: "React",
      },
    },
  },
  {
    expectations: `
      - Must include "california law"
      - Must preserve the California jurisdiction
      - Must not include "brazilian law" or jurisdiction-free "law" as a likely duplicate

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-california-law",
    userInput: {
      suggestion: {
        description: "Legal systems and rules in California.",
        language: "en",
        targetLanguage: null,
        title: "California Law",
      },
    },
  },
  {
    expectations: `
      - Must include "matrix"
      - May include plural "matrices" because the topic is ambiguous
      - Must not overcommit to "the matrix" as the only interpretation

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-matrix-ambiguous",
    userInput: {
      suggestion: {
        description: "A course about matrices or media.",
        language: "en",
        targetLanguage: null,
        title: "Matrix",
      },
    },
  },
];
