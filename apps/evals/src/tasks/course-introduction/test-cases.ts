const SHARED_EXPECTATIONS = `
  - Must be written in the specified language
  - Must include exactly one chapter object with title and description
  - Must include 3-5 lessons
  - Every lesson must be an explanation lesson plan, not a practice, quiz, review, capstone, project, or summary
  - The chapter and lessons must feel like a quick guide to the field, not the first normal technical chapter
  - Must make the field feel concrete, useful, and interesting for a true beginner
  - Must include realistic opportunities, careers, roles, projects, communities, or everyday uses connected to the field
  - Must stay easy enough for a first encounter and avoid deep prerequisites
  - Must be specific to the course topic, not generic learning motivation
  - Must not include lessons about the course itself, the curriculum, the next chapter, the learning path, or how the course goes deeper
  - Every lesson title must name the subject, a subject-specific concept, a concrete field use, or a field-specific role clearly enough that the course topic is identifiable from the title alone
  - Generic meta titles such as "How this course goes deeper", "What this course will help you do", "Your path forward", or translated equivalents are a major issue even when the description mentions the course topic
  - For non-English cases, must not mix in English field, learner, or opportunity labels; translate them naturally
  - Must not promise salaries, credentials, jobs, fluency, mastery, or guaranteed outcomes
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English
      - Should make artificial intelligence feel tangible through examples such as predictions, generation, automation, assistants, search, robotics, creative tools, or decision support
      - Should not become a technical curriculum on neural networks, transformers, backpropagation, RAG, evaluation, or deployment
      - Should mention realistic paths such as product features, research, data work, operations, creative tooling, or responsible use without implying guaranteed careers

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-artificial-intelligence-field-guide",
    userInput: { courseTitle: "Artificial Intelligence", language: "en" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should introduce biology as the study of living systems, from cells and DNA to ecosystems, health, food, environment, or biotechnology
      - Should include interesting hooks such as cells as tiny factories, evolution, microbes, genetics, ecosystems, medicine, agriculture, or conservation
      - Should not become a dense foundation chapter about cell organelles, biochemistry, taxonomy, or lab protocols

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-guia-do-campo",
    userInput: { courseTitle: "Biologia", language: "pt" },
  },
  {
    expectations: `
      - MUST be in US English
      - Should make quantum mechanics feel approachable through concrete hooks such as spectra, chips, sensors, lasers, magnetic resonance, clocks, quantum information, or the limits of everyday intuition
      - Should avoid turning the intro into a math-heavy first chapter about wavefunctions, operators, Hilbert spaces, Schrodinger equations, spin algebra, or measurement postulates
      - Should be honest that the field can become mathematically demanding later, while keeping this chapter focused on curiosity, usefulness, and mental models
      - Should mention realistic paths such as physics, chemistry, materials, computing, engineering, instrumentation, research support, or science communication without implying guaranteed research careers

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-mechanics-approachable-abstraction",
    userInput: { courseTitle: "Quantum Mechanics", language: "en" },
  },
  {
    expectations: `
      - MUST be in US English
      - Should introduce civil procedure as the rules and sequence that move disputes through courts, including filing, notice, deadlines, motions, discovery, hearings, evidence boundaries, settlement pressure, or appeals
      - Should make the field useful to understand without giving legal advice, case strategy, jurisdiction-specific instructions, or promises about bar admission, law school, licensing, or legal employment
      - Should mention realistic roles and uses such as lawyers, paralegals, court staff, compliance teams, journalists, policy workers, advocates, business owners, or people trying to understand legal systems
      - Should avoid becoming a dense technical chapter on personal jurisdiction, claim preclusion, pleading standards, discovery sanctions, or appellate preservation

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-civil-procedure-regulated-field",
    userInput: { courseTitle: "Civil Procedure", language: "en" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should introduce urbanismo as a field about how cities shape daily life through housing, transport, public space, zoning, services, climate, safety, inequality, culture, or local participation
      - Should include concrete everyday hooks such as why a street feels walkable, how transit changes opportunity, why parks matter, how housing rules affect neighborhoods, or how climate risks change planning
      - Should not collapse the field into architecture alone, generic activism, or abstract public policy slogans
      - Should mention realistic paths such as planning teams, mobility projects, housing policy, community organizations, local government, maps, data, design, research, or neighborhood advocacy without promising authority or jobs

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-urbanismo-ciudades-vida-cotidiana",
    userInput: { courseTitle: "Urbanismo", language: "es" },
  },
  {
    expectations: `
      - MUST be in French
      - Should introduce art history as a way to read images, objects, patrons, materials, symbols, markets, museums, archives, politics, religion, technology, or everyday visual culture
      - Should include beginner-friendly hooks such as noticing what an image asks you to look at, how materials change meaning, why context changes interpretation, or how museums decide what becomes visible
      - Should not become a long chronological survey of movements, a list of famous artists, or generic advice about appreciating beauty
      - Should mention realistic paths such as museums, conservation, archives, education, publishing, heritage, curation, research, criticism, design, or cultural work without implying guaranteed careers

      ${SHARED_EXPECTATIONS}
    `,
    id: "fr-histoire-de-lart-humanities-field",
    userInput: { courseTitle: "Histoire de l'art", language: "fr" },
  },
];
