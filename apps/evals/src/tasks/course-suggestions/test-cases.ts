const SHARED_EXPECTATIONS = `
  - The main focus is the \`title\` field, no need to pay much attention to the \`description\` field
  - No level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
  - No words like "course" in the title
  - Titles are always in Title Case
`;

export const TEST_CASES = [
  {
    id: "pt-want-to-code",
    userInput: {
      locale: "pt",
      prompt: "I want to code",
    },
    expectations: `
      - titles should look like these: "Programação","Ciência da Computação","Desenvolvimento Web","Engenharia de Software"
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-black-holes",
    userInput: {
      locale: "en",
      prompt: "quero aprender sobre buracos negros",
    },
    expectations: `
      - should include "Black Holes"
      - may include broader topics like "Astrophysics"
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-derecho-penal",
    userInput: {
      locale: "es",
      prompt: "derecho penal",
    },
    expectations: `
      - should include "Derecho Penal"
      - may include broader topics like "Derecho" or "Criminología"
      - all titles and descriptions in Spain Spanish

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-derecho-chileno",
    userInput: {
      locale: "es",
      prompt: "derecho chileno",
    },
    expectations: `
      - should include "Derecho Chileno" since the user is specifically asking for Chilean law
      - may include similar topics like "Derecho Constitucional Chileno" or "Derecho Penal Chileno"
      - all titles and descriptions in Spain Spanish (not Chilean Spanish) since that's the default for "es" locale

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-toefl",
    userInput: {
      locale: "pt",
      prompt: "quero passar no TOEFL",
    },
    expectations: `
      - should ONLY include "TOEFL" and "Inglês"
      - all titles and descriptions in Brazilian Portuguese
      - no extra titles like "Testes de Proficiência em Inglês", "Preparatório para o TOEFL", etc

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-physics-and-chemistry",
    userInput: {
      locale: "pt",
      prompt: "physics and chemistry",
    },
    expectations: `
      - should include both "Física" and "Química"
      - should NOT include "Física e Química" as a single title
      - may include broader or similar topics but it's not required
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-intro-to-chemistry",
    userInput: {
      locale: "en",
      prompt: "i want an intro to chemistry",
    },
    expectations: `
      - should include "Chemistry" (without "Intro" or "Introduction")
      - do NOT include "Intro to Chemistry"
      - may include broader or similar topics but it's not required
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-dragon-ball",
    userInput: {
      locale: "pt",
      prompt: "dragon ball",
    },
    expectations: `
      - should include "Dragon Ball"
      - optionally, may include broader alts like "Animação", "Cultura Pop" or related suggestions
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-beatles",
    userInput: {
      locale: "en",
      prompt: "beatles",
    },
    expectations: `
      - should include "Beatles" or "The Beatles"
      - optionally, may include broader alts like "Rock", "Music History" or related suggestions
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "fr-f1",
    userInput: {
      locale: "fr",
      prompt: "f1",
    },
    expectations: `
      - should include "Formule 1" or "F1"
      - optionally, may include broader alts like "Sport Automobile", "Courses de Voitures" or related suggestions
      - all titles and descriptions in France French

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-jlpt-n2",
    userInput: {
      locale: "en",
      prompt: "i want to pass the JLPT N2",
    },
    expectations: `
      - should include "JLPT" without the "N2" level suffix
      - should include "Japanese"
      - all titles and descriptions in US English
      - no extra titles like "Japanese Language Proficiency Test", "JLPT N2 Preparation", etc
      - should NOT include any other suggestions

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-ielts-academic",
    userInput: {
      locale: "pt",
      prompt: "quero passar no IELTS Academic",
    },
    expectations: `
      - should ONLY include "IELTS" and "Inglês", strip "Academic" suffix
      - all titles and descriptions in Brazilian Portuguese
      - no extra titles like "Testes de Proficiência em Inglês", "Preparatório para o IELTS", etc
      - should NOT include any other suggestions

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-how-computers-work",
    userInput: {
      locale: "en",
      prompt: "how do computers work",
    },
    expectations: `
      - should include broad caninocals like (but not limited to) "Computer Science", "Computer Architecture", "Operating Systems", etc
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-periodic-table",
    userInput: {
      locale: "pt",
      prompt: "tabela periódica",
    },
    expectations: `
      - should include "Tabela Periódica"
      - may include other chemistry-related topics and broad suggestions like "Química"
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-matrix-movie",
    userInput: {
      locale: "en",
      prompt: "matrix movie",
    },
    expectations: `
      - should include "The Matrix" (the movie)
      - may include other sci-fi related topics and broad suggestions
      - may include broader film-related suggestions
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
];
