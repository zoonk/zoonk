const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. ABC VALIDITY: The abc field must contain valid ABC notation with required headers: X:1, M: (meter), L: (default note length), K: (key). The notation must render correctly in an ABC parser.

2. MUSICAL ACCURACY: The notation must faithfully represent what the VISUAL_DESCRIPTION specifies — correct notes, intervals, rhythm, and key.

3. CONSTRAINTS: Single voice only (no V:), no lyrics (w:), no layout directives (%%), no MIDI directives. Keep notation to 1-4 lines of notes.

4. DESCRIPTION QUALITY: The "description" field must be a brief plain-text explanation (max 100 chars) of what the notation demonstrates. It must NOT be a copy of the VISUAL_DESCRIPTION input.

5. LANGUAGE: The description field must be in the specified language. ABC notation is language-neutral.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-c-major-scale",
    userInput: {
      description:
        "C major scale ascending from middle C to the C one octave above, in quarter notes. 4/4 time signature.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-minor-triad",
    userInput: {
      description:
        "A minor triad: the notes A, C, and E played as a chord, followed by the same three notes played individually as quarter notes. Key of A minor, 4/4 time.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The description field must be in Brazilian Portuguese.
    `,
    id: "pt-ritmo-samba",
    userInput: {
      description:
        "Padrão rítmico básico de samba em 2/4: semicolcheia, colcheia, semicolcheia no primeiro tempo, e colcheia pontuada com semicolcheia no segundo tempo. Repetir por dois compassos.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: The description field must be in Latin American Spanish.
    `,
    id: "es-intervalo-quinta-justa",
    userInput: {
      description:
        "Intervalo de quinta justa ascendente partiendo de Do: primero la nota Do como blanca, luego Sol como blanca. En clave de Sol, compás de 4/4.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-whole-half-notes",
    userInput: {
      description:
        "Demonstration of note durations: a whole note (C), then a half note (D), then two quarter notes (E, F), then four eighth notes (G, A, B, C). Key of C major, 4/4 time. Show how note values divide within measures.",
      language: "en",
    },
  },
];
