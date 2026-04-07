const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

You are evaluating the VISUAL DESCRIPTION stage — the model selects a visual kind and writes a description for each step. A separate system generates the actual visual from this description. Evaluate the KIND SELECTION and DESCRIPTION QUALITY, not the rendered visual.

1. COVERAGE: There must be exactly one visual description per step. Check that the descriptions array length equals the step count.

2. NO REDUNDANCY: Each description must add UNIQUE information. PENALIZE if:
   - Multiple descriptions repeat the same data points, events, or concepts
   - A description restates what another description already covered
   - Example: Two timeline descriptions covering overlapping periods with the same events

3. KIND SELECTION FIT: The visual kind must make sense for the content. PENALIZE if:
   - Code kind is used for non-programming content
   - Chart kind is used without numerical/statistical data (IMPORTANT: if a chart requires fabricating numbers that don't exist in the source text, this is a MAJOR error — score it under majorErrors)
   - Timeline kind is used for content with no temporal/sequential element
   - Quote kind is used with a fabricated, paraphrased, or unverifiable quote
   - Formula kind is used for a single value or trivial comparison (e.g., "109.5°" or "90° < 109.5°" — these are not formulas)
   - Music kind is used for content that merely mentions music without specific notes to notate
   - Code kind is used for mathematical notation (should be formula kind)

   Do NOT penalize if:
   - Image kind is used for any content (image can visualize anything)
   - Diagram kind is used instead of timeline (relationships can be shown multiple ways)
   - Any kind is used multiple times (if each instance adds unique value)

4. DESCRIPTION SPECIFICITY: Descriptions must have enough detail for a downstream system to generate the visual without seeing the original step content. PENALIZE if:
   - Chart descriptions lack data values, axis labels, or trends
   - Table descriptions lack column headers or row data
   - Code descriptions lack the programming language or what the code should demonstrate
   - Diagram descriptions lack node labels or connections
   - Timeline descriptions lack dates or event labels
   - Formula descriptions lack the actual equation
   - Image descriptions are vague (e.g., "an image about the topic")

5. IMAGE TEXT CONTAMINATION: Image descriptions should describe ONLY the scene, objects, and composition — NOT text to display. PENALIZE if:
   - An image description asks for labels, captions, signs, annotations, or visible text that isn't strictly necessary to understand the concept
   - The only way to understand the described image is by reading text within it
   - Exception: a single word or short phrase is acceptable when the concept genuinely requires it (e.g., a protest sign, a storefront name)

6. DIAGRAM COMPLEXITY: Diagrams should be focused and reveal non-obvious structure. PENALIZE if:
   - A diagram description has more than 7 nodes (too complex, loses clarity)
   - A diagram description just restates the text as boxes with arrows (e.g., "A leads to B leads to C" turned into three boxes — this adds nothing)
   - A diagram uses abstract platitude nodes like "Performance", "Simplicity", "Importance" connected by generic verbs — these don't help the reader understand anything new
   - A diagram is used for a simple list of items without meaningful relationships between them (should be a table)

7. LANGUAGE CONSISTENCY: All text in descriptions must match the specified language. PENALIZE any mixed-language content (except the JSON field names and enum values like "chart", "table").

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT expect specific visual kinds based on topic (history does not require timeline; programming does not require code)
- Do NOT penalize for using "image" as the kind — it is a valid choice for any content
- Do NOT penalize for using the same kind multiple times IF each adds unique information
- Do NOT require variety in kinds — consistency is fine if appropriate
- ONLY penalize for: redundant information across descriptions, kind that cannot represent the content, vague descriptions, image text contamination, diagram overcomplexity, language errors, missing steps
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers historical content about the French Revolution (1789-1799).

KIND SELECTION CHECKS - PENALIZE if:
- Code kind is used (no programming content)
- Chart kind is used without meaningful numerical data

DESCRIPTION CHECKS - PENALIZE if:
- Historical dates are wrong in descriptions (key dates: 1789 Bastille, 1791 Constitution, 1793 Reign of Terror, 1799 Napoleon's coup)
- Historical quotes are fabricated or misattributed
- Descriptions are too vague to generate a visual (e.g., "an image of the revolution")
- Image descriptions ask for text overlays, labels, or captions instead of depicting scenes
- Diagram descriptions have more than 7 nodes or use abstract nodes like "Crisis", "Change", "Impact" without concrete relationships

Do NOT PENALIZE if:
- All steps use image kind (valid if each describes distinct content)
- No timeline kind is used (historical content can be visualized many ways)

${SHARED_EXPECTATIONS}
    `,
    id: "en-history-french-revolution",
    userInput: {
      chapterTitle: "Revolutionary Era",
      courseTitle: "World History",
      language: "en",
      lessonDescription:
        "Understanding the causes, key events, and lasting impact of the French Revolution on modern political systems",
      lessonTitle: "The French Revolution",
      steps: [
        {
          text: "By 1789, France was in crisis. The monarchy was bankrupt, harvests had failed, and the common people were starving while the nobility lived in luxury.",
          title: "A Nation in Crisis",
        },
        {
          text: "On July 14, 1789, Parisians stormed the Bastille fortress. This wasn't just about freeing prisoners - it symbolized the people rising against tyranny.",
          title: "The Storming of the Bastille",
        },
        {
          text: "The revolutionaries declared that all men are born free and equal. This radical idea challenged centuries of aristocratic privilege and divine right of kings.",
          title: "Liberty, Equality, Fraternity",
        },
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers JavaScript closures - a programming concept.

KIND SELECTION CHECKS - PENALIZE if:
- Timeline kind is used (closures are not a historical/sequential topic)
- Chart kind is used without numerical data
- Formula kind is used (closures are a programming concept, not math)

DESCRIPTION CHECKS - PENALIZE if:
- Code descriptions have technical inaccuracies about closures
- Code descriptions don't specify the programming language
- Descriptions are too vague to generate working code
- Diagram descriptions use abstract nodes like "Scope", "Memory", "Function" without concrete relationships (prefer code to show actual closure mechanics)
- Image descriptions include text/labels when a code snippet would be more appropriate

Do NOT PENALIZE if:
- Image kind is used (can describe conceptual diagrams of scope)
- Diagram kind is used to describe scope chains
- Not all steps use code kind

${SHARED_EXPECTATIONS}
    `,
    id: "en-programming-closures",
    userInput: {
      chapterTitle: "Advanced Functions",
      courseTitle: "JavaScript Fundamentals",
      language: "en",
      lessonDescription:
        "Understanding closures - how functions remember their lexical scope even when executed outside of it",
      lessonTitle: "Understanding Closures",
      steps: [
        {
          text: "A closure is created when a function 'remembers' variables from its surrounding scope, even after that scope has finished executing.",
          title: "What is a Closure?",
        },
        {
          text: "When you return a function from another function, the inner function carries its environment with it. It can access variables that no longer exist in the call stack.",
          title: "Functions Carrying Their Environment",
        },
        {
          text: "Closures are commonly used to create private variables. The outer function's variables become hidden, accessible only through the returned function.",
          title: "Practical Use: Private State",
        },
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers photosynthesis - a biological process.

LANGUAGE REQUIREMENT: All description content must be in Portuguese.

KIND SELECTION CHECKS - PENALIZE if:
- Code kind is used (no programming content)
- Timeline kind is used (photosynthesis is not a historical topic)

DESCRIPTION CHECKS - PENALIZE if:
- Scientific process is incorrect (inputs: light, CO2, H2O; outputs: glucose, O2)
- Any description text is in English instead of Portuguese
- Descriptions are too vague to generate a visual
- Image descriptions ask for text labels or annotations instead of depicting the scene
- Diagram descriptions have more than 7 nodes

Do NOT PENALIZE if:
- Image kind is used for all steps
- Diagram kind is used to describe the process flow
- Formula kind is used for the chemical equation (6CO2 + 6H2O → C6H12O6 + 6O2)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biology-photosynthesis",
    userInput: {
      chapterTitle: "Processos Celulares",
      courseTitle: "Biologia para Iniciantes",
      language: "pt",
      lessonDescription:
        "Entendendo como as plantas convertem luz solar em energia através da fotossíntese",
      lessonTitle: "Fotossíntese",
      steps: [
        {
          text: "As plantas capturam energia da luz solar usando clorofila, o pigmento verde presente nas folhas. Essa energia será usada para criar alimento.",
          title: "Capturando Luz",
        },
        {
          text: "A planta absorve dióxido de carbono do ar pelos estômatos e água do solo pelas raízes. Esses são os ingredientes necessários.",
          title: "Os Ingredientes",
        },
        {
          text: "Usando a energia da luz, a planta combina CO2 e água para produzir glicose e oxigênio. A glicose é o alimento da planta.",
          title: "A Transformação",
        },
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers market share - an economics/business concept with numerical data.

KIND SELECTION CHECKS - PENALIZE if:
- Code kind is used (no programming content)
- Timeline kind is used for content that isn't about historical market evolution

DESCRIPTION CHECKS - PENALIZE if:
- Chart descriptions have unrealistic data (e.g., market share values that don't make sense)
- Descriptions are too vague to generate the visual
- Image descriptions ask for text labels, percentages, or data overlays instead of depicting scenes
- Diagram descriptions use abstract nodes like "Power", "Scale", "Cost" without concrete relationships

Do NOT penalize for minor approximations in chart data descriptions (e.g., values summing to exactly 60% when the text says "over 60%").

Do NOT PENALIZE if:
- Image kind is used
- No chart kind is used (market share can be explained without charts)
- Diagram kind is used to describe market relationships

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-market-share",
    userInput: {
      chapterTitle: "Market Analysis",
      courseTitle: "Business Economics",
      language: "en",
      lessonDescription:
        "Understanding how market share is measured and what it reveals about competitive dynamics",
      lessonTitle: "Understanding Market Share",
      steps: [
        {
          text: "Market share represents the percentage of total sales in an industry captured by a single company. A higher share often means more pricing power.",
          title: "What is Market Share?",
        },
        {
          text: "In the smartphone market, the top three manufacturers control over 60% of global sales. This concentration affects how the entire industry operates.",
          title: "Concentration in Action",
        },
        {
          text: "Companies with dominant market share can achieve economies of scale, spreading fixed costs over more units and lowering per-unit costs.",
          title: "The Scale Advantage",
        },
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers mindfulness - an abstract psychological/wellness concept.

KIND SELECTION CHECKS - PENALIZE if:
- Code kind is used (no programming content)
- Music kind is used (no musical notation content)
- Timeline kind is used (mindfulness is not a historical topic)
- Chart kind is used without meaningful data (IMPORTANT: Step 2 "Benefits of Practice" contains ONLY qualitative descriptions like "reduce stress" and "improve focus" with NO numerical data. If chart kind is selected for this step, the model MUST fabricate numbers. This is ALWAYS a MAJOR error.)

DESCRIPTION CHECKS - PENALIZE if:
- Descriptions are too vague or generic
- Quote descriptions reference fabricated or unverifiable quotes
- Image descriptions include text labels, words, or annotations (mindfulness is a visual/experiential concept — describe scenes, not text)
- Diagram descriptions use abstract platitude nodes like "Calm", "Focus", "Awareness" with generic connections — these don't add insight beyond the text

Do NOT PENALIZE if:
- Image kind is used for all steps (very appropriate for abstract concepts)
- No specialized visual kinds are used

${SHARED_EXPECTATIONS}
    `,
    id: "en-psychology-mindfulness",
    userInput: {
      chapterTitle: "Mental Wellness",
      courseTitle: "Introduction to Psychology",
      language: "en",
      lessonDescription:
        "Understanding mindfulness as a practice for improving mental clarity and emotional regulation",
      lessonTitle: "The Practice of Mindfulness",
      steps: [
        {
          text: "Mindfulness means paying attention to the present moment without judgment. Instead of worrying about the future or dwelling on the past, you observe what's happening now.",
          title: "Being Present",
        },
        {
          text: "Your breath is always with you, making it a perfect anchor for attention. When your mind wanders, simply notice it and gently return to the breath.",
          title: "The Breath Anchor",
        },
        {
          text: "Regular mindfulness practice has been shown to reduce stress, improve focus, and help people respond rather than react to difficult situations.",
          title: "Benefits of Practice",
        },
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers music theory - the major scale pattern.

KIND SELECTION CHECKS - PENALIZE if:
- Code kind is used (no programming content)
- Chart kind is used without numerical data
- Timeline kind is used (not a historical topic)
- Image kind is used for steps that describe specific notes or scales (music kind renders real notation — prefer it over an image of notation)

DESCRIPTION CHECKS - PENALIZE if:
- Music descriptions have wrong notes (C major: C-D-E-F-G-A-B-C, G major: G-A-B-C-D-E-F#-G)
- Music descriptions don't specify key, time signature, or notes
- Descriptions are too vague to generate the visual
- Image descriptions ask for text showing note names or scale patterns instead of depicting a scene

Do NOT PENALIZE if:
- Not all steps use music kind (table or image can supplement)
- Music kind is used for all steps (if each describes distinct notation)
- Table kind is used to compare scale degrees or intervals

${SHARED_EXPECTATIONS}
    `,
    id: "en-music-major-scale",
    userInput: {
      chapterTitle: "Scales and Keys",
      courseTitle: "Music Theory Fundamentals",
      language: "en",
      lessonDescription:
        "Understanding the major scale pattern and how it forms the foundation of Western music",
      lessonTitle: "The Major Scale",
      steps: [
        {
          text: "The major scale follows a specific pattern of whole and half steps: W-W-H-W-W-W-H. Starting from C, this gives us C-D-E-F-G-A-B-C with no sharps or flats.",
          title: "The Pattern",
        },
        {
          text: "When we start the same whole-half pattern from G, we need one sharp (F#) to maintain the intervals. This gives us the G major scale: G-A-B-C-D-E-F#-G.",
          title: "Transposing to G",
        },
        {
          text: "The distance between any two adjacent notes is called an interval. In a major scale, the interval from the first to the fifth note (like C to G) is called a perfect fifth.",
          title: "Intervals in the Scale",
        },
      ],
    },
  },
];
