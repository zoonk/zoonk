const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. COVERAGE: Every step must have exactly one visual. Check that the number of visuals equals the number of steps and stepIndex values are unique and complete (0 to N-1).

2. NO REDUNDANCY: Each visual must add UNIQUE information. PENALIZE if:
   - Multiple visuals repeat the same data points, events, or concepts
   - A visual restates what another visual already showed
   - Example: Two timelines covering overlapping periods with the same events

3. VISUAL-CONTENT FIT: The visual type must make sense for the content. PENALIZE if:
   - Code visual is used for non-programming content
   - Chart is used without numerical/statistical data to display (IMPORTANT: if a chart forces the model to fabricate numbers that don't exist in the source text, this is a MAJOR error - score it under majorErrors, not minorErrors)
   - Timeline is used for content with no temporal/sequential element
   - Quote is fabricated or misattributed (must be real, verifiable quotes)

   Do NOT penalize if:
   - Image is used for any content (image can visualize anything)
   - Diagram is used instead of timeline (relationships can be shown multiple ways)
   - Any visual type is used multiple times (if each instance adds unique value)

4. TECHNICAL ACCURACY: Visual content must be factually correct:
   - Code must be syntactically valid
   - Historical dates and events must be accurate
   - Scientific processes must be correctly represented
   - Chart data must be realistic and internally consistent

5. LANGUAGE CONSISTENCY: All text in visuals must match the specified language. PENALIZE any mixed-language content.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT expect specific visual types based on topic (history does not require timeline; programming does not require code)
- Do NOT penalize for using "image" as the visual type - it is a valid choice for any content
- Do NOT penalize for using the same visual type multiple times IF each adds unique information
- Do NOT require variety in visual types - consistency is fine if appropriate
- ONLY penalize for: redundant information across visuals, visual type that cannot represent the content, technical inaccuracies, language errors, missing steps
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

This test covers historical content about the French Revolution (1789-1799).

ACCURACY CHECKS - PENALIZE if:
- Any historical dates are wrong (key dates: 1789 Bastille, 1791 Constitution, 1793 Reign of Terror, 1799 Napoleon's coup)
- Historical quotes are fabricated or misattributed
- Cause-effect relationships are historically inaccurate

REDUNDANCY CHECKS - PENALIZE if:
- Multiple visuals cover the same historical events
- The same dates/figures appear across different visuals without adding new information

VISUAL-CONTENT FIT - PENALIZE if:
- Code visual is used (no programming content)
- Chart visual is used without meaningful numerical data

Do NOT PENALIZE if:
- All steps use image visuals (valid if each shows distinct content)
- No timeline is used (historical content can be visualized many ways)
- A diagram showing cause-effect is used instead of a timeline

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

ACCURACY CHECKS - PENALIZE if:
- Code snippets have syntax errors
- Code doesn't actually demonstrate closures (must show inner function accessing outer scope)
- Technical explanations are incorrect

REDUNDANCY CHECKS - PENALIZE if:
- Multiple code snippets show essentially the same pattern
- The same closure example is repeated across visuals

VISUAL-CONTENT FIT - PENALIZE if:
- Timeline is used (closures are not a historical/sequential topic)
- Chart is used without numerical data

Do NOT PENALIZE if:
- Image visuals are used (can show conceptual diagrams of scope)
- Diagram is used to show scope chains
- Not all steps use code visuals

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

LANGUAGE REQUIREMENT: All visual content must be in Portuguese.

ACCURACY CHECKS - PENALIZE if:
- Scientific process is incorrect (inputs: light, CO2, H2O; outputs: glucose, O2)
- Any text is in English instead of Portuguese
- Biological terminology is wrong

REDUNDANCY CHECKS - PENALIZE if:
- Multiple visuals show the same stage of photosynthesis
- The same chemical equation or process diagram is repeated

VISUAL-CONTENT FIT - PENALIZE if:
- Code visual is used (no programming content)
- Timeline is used (photosynthesis is not a historical topic)

Do NOT PENALIZE if:
- Image visuals are used for all steps
- Diagram is used to show the process flow
- Chart showing energy conversion data is used

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

ACCURACY CHECKS - PENALIZE if:
- Chart data is unrealistic (e.g., market share values that don't make sense)
- Economic concepts are incorrectly explained
- Pie chart values don't sum to 100% (if pie chart is used)

Do NOT penalize for minor approximations in generated chart data (e.g., values summing to exactly 60% when the text says "over 60%" is acceptable - the spirit of the data is correct).

REDUNDANCY CHECKS - PENALIZE if:
- Multiple charts show the same data
- The same market share examples are repeated across visuals

VISUAL-CONTENT FIT - PENALIZE if:
- Code visual is used (no programming content)
- Timeline is used for content that isn't about historical market evolution

Do NOT PENALIZE if:
- Image visuals are used
- No chart is used (market share can be explained without charts)
- Diagram showing market relationships is used

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

ACCURACY CHECKS - PENALIZE if:
- Quotes are fabricated or misattributed (if quotes are used, they must be real)
- Scientific claims about mindfulness benefits are inaccurate

REDUNDANCY CHECKS - PENALIZE if:
- Multiple visuals depict the same mindfulness concept
- The same breathing/meditation technique is shown repeatedly

VISUAL-CONTENT FIT - PENALIZE if:
- Code visual is used (no programming content)
- Timeline is used (mindfulness is not a historical topic)
- Chart is used without meaningful data (IMPORTANT: Step 2 "Benefits of Practice" contains ONLY qualitative descriptions like "reduce stress" and "improve focus" with NO numerical data. If a chart is used for this step, the model MUST fabricate numbers to populate it. This is ALWAYS a MAJOR error because it presents made-up statistics as educational facts. Score it under majorErrors, not minorErrors.)

Do NOT PENALIZE if:
- Image visuals are used for all steps (very appropriate for abstract concepts)
- No specialized visual types are used
- Quotes from meditation teachers are used (if real and properly attributed)

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
];
