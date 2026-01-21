const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. NATIVE LANGUAGE PHONEMES ONLY (CRITICAL - highest priority):
   - The pronunciation MUST use ONLY letters and letter combinations that exist in the native language
   - A native speaker should be able to read it without any special knowledge
   - Penalize SEVERELY if IPA symbols, foreign letters, or non-standard diacritics are used
   - Penalize if letter combinations don't naturally occur in the native language

2. STRESS INDICATION:
   - Stressed syllable should be marked with CAPITAL letters
   - For multi-syllable words, exactly one syllable should be capitalized
   - For single-syllable words, the entire word may be capitalized
   - Penalize if stress is not indicated at all
   - Do NOT penalize for different but valid stress placements if linguistically acceptable

3. SYLLABLE SEPARATION:
   - Multi-syllable words should use hyphens to separate syllables
   - Single-syllable words do not need hyphens
   - Penalize if long words are written without syllable breaks
   - Do NOT penalize for slightly different syllable divisions if they're linguistically reasonable

4. SOUND APPROXIMATION QUALITY:
   - When target language sounds don't exist in native language, the closest approximation should be used
   - The approximation should produce a recognizable pronunciation when spoken aloud
   - Penalize if sounds are simply omitted rather than approximated
   - Do NOT require specific approximations - accept any reasonable phonetic mapping

5. READABILITY:
   - The output should look like something a native speaker could naturally pronounce
   - Avoid awkward letter combinations that would confuse a native reader
   - The pronunciation should flow naturally when read aloud
   - Penalize if the output looks unpronounceable or confusing

6. COMPLETENESS:
   - All sounds in the word should be represented
   - Silent letters should be appropriately handled (omitted from pronunciation)
   - Penalize if significant sounds are missing from the pronunciation

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for using different but valid phonetic representations
- Do NOT require exact matches to any expected pronunciation
- Do NOT penalize for stylistic choices (e.g., "ou" vs "ow" for the same sound)
- Different valid approximations exist for the same sound - assess whether the chosen one is reasonable
- FOCUS ON: native language compatibility, stress marking, readability, sound completeness
- The test is whether a native speaker could read this and produce a recognizable approximation of the target word
`;

export const TEST_CASES = [
  {
    expectations: `
NATIVE LANGUAGE: Portuguese (Brazilian)
TARGET LANGUAGE: English

WORD: "beautiful"

This is a complex English word with:
- The "beau-" diphthong (sounds like "byoo")
- The unstressed "-ti-" syllable
- The "-ful" ending

SOUND CHALLENGES:
- The "eau" combination needs Portuguese-compatible representation
- The word has 3 syllables with stress on the first

QUALITY CHECK:
- Should be readable by a Brazilian Portuguese speaker
- Should indicate stress on the first syllable
- Should approximate the "byoo" sound using Portuguese phonemes
- Penalize if it uses letters/combinations that don't exist in Portuguese

${SHARED_EXPECTATIONS}
    `,
    id: "pt-english-beautiful",
    userInput: {
      nativeLanguage: "pt",
      targetLanguage: "English",
      word: "beautiful",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Portuguese (Brazilian)
TARGET LANGUAGE: English

WORD: "through"

This is a challenging English word with:
- The "th" sound (doesn't exist in Portuguese)
- The "ough" combination (silent letters)
- Single syllable

SOUND CHALLENGES:
- "th" must be approximated with a Portuguese sound (commonly "f", "s", or "t")
- The "ough" is pronounced as "oo" - most letters are silent
- The "r" sound differs between English and Portuguese

QUALITY CHECK:
- Should be readable by a Brazilian Portuguese speaker
- Should handle the "th" with an appropriate approximation
- Should NOT include silent letters in pronunciation
- Penalize if it tries to pronounce the "gh"

${SHARED_EXPECTATIONS}
    `,
    id: "pt-english-through",
    userInput: {
      nativeLanguage: "pt",
      targetLanguage: "English",
      word: "through",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Portuguese (Brazilian)
TARGET LANGUAGE: English

WORD: "squirrel"

This is one of the most difficult English words for Portuguese speakers with:
- The "squ-" cluster
- The American "r" sound
- The unstressed "-el" ending
- Two syllables with complex consonant clusters

SOUND CHALLENGES:
- The "qu" followed by "i" creates a challenging sound
- Double "r" in American English
- The "-el" ending is often reduced

QUALITY CHECK:
- Should be readable by a Brazilian Portuguese speaker
- Should handle the consonant clusters reasonably
- Should indicate which syllable is stressed
- Accept various valid approximations for this difficult word

${SHARED_EXPECTATIONS}
    `,
    id: "pt-english-squirrel",
    userInput: {
      nativeLanguage: "pt",
      targetLanguage: "English",
      word: "squirrel",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Spanish (Latin American)
TARGET LANGUAGE: English

WORD: "comfortable"

This is a common English word with:
- Four syllables in careful speech, often reduced to three in casual speech
- The "mf" consonant cluster
- Stress on the first syllable

SOUND CHALLENGES:
- The word is often pronounced "KUMF-ter-bul" in casual speech
- The "o" in "-for-" is often reduced to a schwa
- Spanish speakers need approximation for reduced vowels

QUALITY CHECK:
- Should be readable by a Spanish speaker
- Should indicate stress (typically first syllable)
- Should handle the consonant cluster "mf"
- Accept either full or reduced pronunciation representations

${SHARED_EXPECTATIONS}
    `,
    id: "es-english-comfortable",
    userInput: {
      nativeLanguage: "es",
      targetLanguage: "English",
      word: "comfortable",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Spanish (Latin American)
TARGET LANGUAGE: English

WORD: "vegetable"

This English word features:
- The "v" sound (often becomes "b" in Spanish)
- The soft "g" before "e"
- Reduced vowels in unstressed syllables
- Four syllables, often reduced

SOUND CHALLENGES:
- Spanish doesn't distinguish "v" from "b"
- The "-table" ending has a reduced vowel
- Stress is on the first syllable

QUALITY CHECK:
- Should be readable by a Spanish speaker
- Should indicate stress on first syllable
- May use "b" for "v" sound (acceptable in Spanish approximation)
- Should handle the soft "g" sound

${SHARED_EXPECTATIONS}
    `,
    id: "es-english-vegetable",
    userInput: {
      nativeLanguage: "es",
      targetLanguage: "English",
      word: "vegetable",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Spanish (Latin American)
TARGET LANGUAGE: English

WORD: "rhythm"

This is a difficult English word with:
- No vowel letters between "rh" and "thm"
- The "th" sound (doesn't exist in Spanish)
- Silent "h" at the beginning
- The final "-thm" cluster

SOUND CHALLENGES:
- "rh" is pronounced just as "r"
- "y" functions as a vowel
- "th" needs Spanish approximation (commonly "t", "d", or "z")
- The "-thm" ending is challenging

QUALITY CHECK:
- Should be readable by a Spanish speaker
- Should provide a vowel sound for the "y"
- Should approximate "th" with available Spanish sounds
- Single syllable, so stress marking is straightforward

${SHARED_EXPECTATIONS}
    `,
    id: "es-english-rhythm",
    userInput: {
      nativeLanguage: "es",
      targetLanguage: "English",
      word: "rhythm",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: English (US)
TARGET LANGUAGE: Portuguese

WORD: "desenvolvimento"

This is a long Portuguese word meaning "development" with:
- Six syllables
- The nasal "en" sounds
- The "lv" consonant cluster
- Stress on the penultimate syllable (-MEN-)

SOUND CHALLENGES:
- Multiple nasal vowels that don't exist in English
- The "lh" would need approximation but this word has "lv"
- Long word requires clear syllable separation

QUALITY CHECK:
- Should be readable by an English speaker
- Should clearly mark stress on the -MEN- syllable
- Should handle nasal sounds with English approximations
- Should separate all six syllables clearly

${SHARED_EXPECTATIONS}
    `,
    id: "en-portuguese-desenvolvimento",
    userInput: {
      nativeLanguage: "en",
      targetLanguage: "Portuguese",
      word: "desenvolvimento",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: English (US)
TARGET LANGUAGE: Portuguese

WORD: "parabens"

This Portuguese word (congratulations) features:
- Three syllables
- Nasal ending "-ens"
- The Portuguese "r" sound (different from English)
- Stress on the last syllable

SOUND CHALLENGES:
- The nasal "-ens" ending is challenging for English speakers
- The "a" vowels are open
- Portuguese "r" between vowels

QUALITY CHECK:
- Should be readable by an English speaker
- Should indicate stress on the final syllable
- Should approximate the nasal ending
- Accept various representations of the nasal sound

${SHARED_EXPECTATIONS}
    `,
    id: "en-portuguese-parabens",
    userInput: {
      nativeLanguage: "en",
      targetLanguage: "Portuguese",
      word: "parabens",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: English (US)
TARGET LANGUAGE: Spanish

WORD: "ferrocarril"

This Spanish word (railroad) features:
- Four syllables
- Double "rr" (rolled/trilled r)
- The Spanish "j" sound is not present but the "rr" is challenging
- Stress on the final syllable

SOUND CHALLENGES:
- The "rr" requires a trill that doesn't exist in English
- Two instances of "r" sounds (single and double)
- Stress on final syllable "-rril"

QUALITY CHECK:
- Should be readable by an English speaker
- Should indicate stress on the last syllable
- Should provide some approximation for the rolled "rr"
- Should separate syllables clearly for this four-syllable word

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-ferrocarril",
    userInput: {
      nativeLanguage: "en",
      targetLanguage: "Spanish",
      word: "ferrocarril",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: English (US)
TARGET LANGUAGE: Spanish

WORD: "murciélago"

This Spanish word (bat - the animal) is famous for containing all 5 vowels:
- Four syllables
- The accent on "é" indicates stress
- The "c" before "i" is soft (like "s" in Latin American Spanish)
- Contains all five Spanish vowels

SOUND CHALLENGES:
- The "ci" combination sounds like "see"
- The "g" before "o" is hard
- Stress is on the third syllable (indicated by accent)

QUALITY CHECK:
- Should be readable by an English speaker
- Should indicate stress on the "-CIÉ-" syllable
- Should handle the soft "c" before "i"
- Should separate all four syllables

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-murcielago",
    userInput: {
      nativeLanguage: "en",
      targetLanguage: "Spanish",
      word: "murcielago",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Portuguese (Brazilian)
TARGET LANGUAGE: English

WORD: "cat"

This is a simple, single-syllable English word:
- Short "a" vowel sound
- Simple consonants
- No complex clusters

SOUND CHALLENGES:
- The short "a" in "cat" is between Portuguese "a" and "é"
- Very straightforward word

QUALITY CHECK:
- Should be readable by a Brazilian Portuguese speaker
- Single syllable, so can be entirely capitalized or just marked appropriately
- Should be simple and direct
- This tests handling of easy words (should not overcomplicate)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-english-cat",
    userInput: {
      nativeLanguage: "pt",
      targetLanguage: "English",
      word: "cat",
    },
  },
  {
    expectations: `
NATIVE LANGUAGE: Spanish (Latin American)
TARGET LANGUAGE: English

WORD: "go"

This is one of the simplest English words:
- Single syllable
- Diphthong "o" sound (like "oh" + slight "w")
- Simple consonant

SOUND CHALLENGES:
- The English "o" is actually a diphthong
- Very straightforward for Spanish speakers

QUALITY CHECK:
- Should be readable by a Spanish speaker
- Single syllable, simple stress handling
- Should not overcomplicate this easy word
- Tests that the model doesn't add unnecessary complexity

${SHARED_EXPECTATIONS}
    `,
    id: "es-english-go",
    userInput: {
      nativeLanguage: "es",
      targetLanguage: "English",
      word: "go",
    },
  },
];
