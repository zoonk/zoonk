const SHARED_EXPECTATIONS = `
  - Must return concise database search strings in the "queries" array
  - This is candidate retrieval, not final identity classification
  - Must optimize for recall so the next identity task can inspect plausible database candidates
  - Must include important title terms, abbreviations, expanded forms, translations, native-script terms, and canonical names when they apply
  - Must preserve retrieval-critical qualifiers such as jurisdiction, target language, named framework, named exam, or named certification
  - Exact-title repeats and redundant longer phrases are minor issues, not major failures
  - Broad, narrower, or adjacent but plausible candidate-retrieval terms are minor issues at worst; the identity task decides whether candidates are actually the same course
  - Must not use generic filler words by themselves, such as "course", "introduction", "basics", "learn", "development", "engineering", or "programming"
  - Must not pad the list with weak terms that are unlikely to appear in a course title
  - If the output omits an explicitly required recall-critical key, the majorErrors score must be 6.5 or lower
`;

export const TEST_CASES = [
  {
    expectations: `
      - Must include "frontend" and "front end"
      - Could include "front-end"
      - Should include "client side"
      - Must not include generic "engineering" or "development" by itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-engineering",
    userInput: {
      proposedCourse: {
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
      - Must include "client side"
      - Must not include generic "development" by itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-client-side-development",
    userInput: {
      proposedCourse: {
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
      - Could include "py"
      - Could include "data science", "data analysis", or "data analytics" as candidate-retrieval terms
      - Must not score "data science", "data analysis", or "data analytics" as major errors; those candidates are for the identity task to reject if needed
      - Should avoid narrower library terms like "pandas", "NumPy", or "scikit-learn" unless they appear in the proposed course title or description
      - If the output omits "python", the majorErrors score must be 6.5 or lower

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-python-for-data-science",
    userInput: {
      proposedCourse: {
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
      - Could include "aprendizado de máquina" even though the exact title is already searched

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-aprendizado-de-maquina",
    userInput: {
      proposedCourse: {
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
      - Should include "Test of English as a Foreign Language"
      - Could include exam formats such as "iBT" if paired with stronger English/TOEFL recall
      - If the output omits English-language recall and only returns exam-specific names, formats, or versions, the majorErrors score must be 7.5 or lower

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-toefl-english",
    userInput: {
      proposedCourse: {
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
      - Must include at least one Simplified Chinese native-script term such as "中文", "汉语", or "普通话"
      - Must include at least one Traditional Chinese native-script term such as "漢語" or "普通話"
      - Must include "HSK"
      - Should include "Hanyu Shuiping Kaoshi"
      - Must not stop at eight queries when more strong Chinese-language variants are relevant
      - Must not include unrelated Asian languages such as Japanese or Korean

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-mandarin-chinese",
    userInput: {
      proposedCourse: {
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
      - Could include "F1" even though the exact title is already searched
      - Could include adjacent racing terms, but missing "formula one" is the serious recall failure
      - Must not include unrelated formula/math queries
      - If the output omits "formula one", the majorErrors score must be 6.5 or lower

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-f1",
    userInput: {
      proposedCourse: {
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
      - Must not include "c" by itself or "c programming"
      - Must not include generic "programming" by itself
      - If the output omits "c++", the majorErrors score must be 6.5 or lower
      - If the output omits either "cpp" or "c plus plus", the majorErrors score must be 7.5 or lower

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-c-plus-plus-programming",
    userInput: {
      proposedCourse: {
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
      - Must not include "brazilian law" or jurisdiction-free "law" as a likely duplicate

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ca-law",
    userInput: {
      proposedCourse: {
        description: "Legal systems and rules in California.",
        language: "en",
        targetLanguage: null,
        title: "CA Law",
      },
    },
  },
];
