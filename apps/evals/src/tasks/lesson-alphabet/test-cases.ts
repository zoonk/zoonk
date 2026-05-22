const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FOCUSED INVENTORY: The output must infer a small playable symbol inventory from the lesson title and description. Include the exact compact set when listed, and do not expand to a whole alphabet, syllabary, abjad, abugida, or broad beginner category.

2. INTRO QUALITY: intro is optional. If present, it should be short, conversational, and directly useful before the cards. It must not repeat generic script overview content or sound academic.

3. INLINE ROMANIZATION: Any non-Roman characters, words, or combinations mentioned in intro prose must have an adjacent reading cue. Native-first pairs like "か (ka)" are preferred, but romanization-first pairs like "ka (か)" are also acceptable. Penalize only missing or ambiguous reading cues.

4. USER-LANGUAGE COPY: intro, pronunciation, and form labels must be in the user's language. Only use English when the user language is English.

5. NO SYMBOL NOTES: symbols must not include a note field or note-like filler. Per-symbol cards should focus on symbol, readingAid, pronunciation, and forms.

6. ACCURACY: Symbols, reading aids, audioText, pronunciation hints, and forms must be linguistically accurate and beginner-safe.
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Japanese
USER LANGUAGE: English

TOPIC: Hiragana K row. The inventory should include exactly か, き, く, け, こ. Intro should not explain what hiragana is. A useful intro can say the row is k plus the five vowels using adjacent reading cues, e.g. か (ka) or ka (か).

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-hiragana-k-row-alphabet",
    userInput: {
      chapterTitle: "Hiragana",
      lessonDescription: "Recognize か, き, く, け, こ and read the sounds ka, ki, ku, ke, ko",
      lessonTitle: "K row かきくけこ",
      targetLanguage: "ja",
      userLanguage: "en",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean
USER LANGUAGE: Spanish (Latin American)

TOPIC: First Hangul consonants. The inventory should include exactly ㄱ, ㄴ, ㄷ, ㄹ. Intro can explain that these consonants appear inside syllable blocks, but it should stay short, use plain Spanish, and avoid adding extra consonants as inventory.

${SHARED_EXPECTATIONS}
    `,
    id: "es-korean-first-consonants-alphabet",
    userInput: {
      chapterTitle: "Consonantes de Hangul",
      lessonDescription:
        "Reconocer ㄱ, ㄴ, ㄷ, ㄹ y verlos dentro de bloques simples como 가, 나, 다, 라",
      lessonTitle: "Primeras consonantes ㄱ ㄴ ㄷ ㄹ",
      targetLanguage: "ko",
      userLanguage: "es",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Arabic
USER LANGUAGE: Brazilian Portuguese

TOPIC: Arabic letter Ba joining forms. The inventory should include exactly ب, with real isolated, initial, medial, and final forms using Portuguese labels. Intro should explain only what helps learners recognize this one letter joining right-to-left, without turning it into a broad Arabic alphabet overview.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-arabic-ba-joining-forms-alphabet",
    userInput: {
      chapterTitle: "Letras árabes que se conectam",
      lessonDescription:
        "Reconhecer a letra ب e suas formas quando aparece sozinha, no começo, no meio e no fim da palavra",
      lessonTitle: "Formas da letra ب",
      targetLanguage: "ar",
      userLanguage: "pt",
    },
  },
];
