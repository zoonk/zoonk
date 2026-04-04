const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. CONTENT FOCUS: The prompt must describe WHAT to depict, not HOW to style it. No art style instructions, camera angles, or rendering techniques — the image generator handles style.

2. SPECIFICITY: The prompt must be specific enough for an image generation model to produce a relevant visual. Vague prompts like "a relevant scene" are unacceptable.

3. NO COPYRIGHTED CONTENT: The prompt must NEVER reference copyrighted or trademarked characters (e.g., Mickey Mouse, Spider-Man, Mario). If the input mentions such characters, the output must describe the concept abstractly.

4. TEXT HANDLING: The prompt should avoid text in the image by default. If text is necessary, it must be minimal and spelled exactly in the specified LANGUAGE with correct accents/diacritics.

5. REFINEMENT: The output should refine the input description for image generation — not just copy it verbatim. Add spatial composition cues and visual details where helpful.

6. LANGUAGE: The prompt must be written in the specified LANGUAGE.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-server-room-investigation",
    userInput: {
      description:
        "A busy server room with rows of rack-mounted servers. Several status LEDs are blinking amber instead of green. One rack has cables visibly disconnected and hanging loose. A network switch in the corner shows a red warning light.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-microscope-slide",
    userInput: {
      description:
        "A microscope view of a biological sample showing cells with irregular shapes. Some cells appear darker and more densely packed than others. A few cells show visible internal structures that look abnormal compared to the surrounding healthy cells.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-cracked-building-wall",
    userInput: {
      description:
        "Close-up of a stone wall showing diagonal cracks running from a window corner toward the ceiling. The crack edges are light-colored and fresh, contrasting with the darker weathered stone surface around them. Mortar between stones is crumbling in places near the crack.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The prompt must be in Brazilian Portuguese.
    `,
    id: "pt-laboratorio-quimico",
    userInput: {
      description:
        "Bancada de laboratório químico com vários béqueres contendo líquidos de cores diferentes. Um dos béqueres tem um precipitado escuro no fundo. Ao lado, há um papel de teste de pH mostrando uma cor inesperada (azul escuro em vez do esperado verde). Equipamento de destilação ao fundo.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The prompt must be in Latin American Spanish.
    `,
    id: "es-escena-geologica",
    userInput: {
      description:
        "Corte transversal de un terreno mostrando capas geológicas. La capa superior es tierra oscura, seguida de arcilla rojiza, luego roca sedimentaria con fósiles visibles, y finalmente roca base gris. Una falla diagonal cruza todas las capas, desplazándolas visiblemente.",
      language: "es",
    },
  },
];
