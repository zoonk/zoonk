const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. TOPIC-APPROPRIATE COVERAGE: The vocabulary list should cover the narrow lesson topic appropriately.
   - Include words directly relevant to the specific lesson focus
   - A narrow topic (like "Ordering Coffee") needs fewer words than a broad one
   - Do NOT penalize for vocabulary count - focus on relevance and quality
   - Do NOT expect exhaustive coverage of the broader domain (e.g., don't expect all food words for a coffee-ordering lesson)

2. TRANSLATION ACCURACY (CRITICAL - highest priority):
   - Each word-translation pair MUST be linguistically accurate
   - Consider regional variations (Brazilian Portuguese vs European, Latin American Spanish vs Castilian)
   - The translation must match the EXACT meaning - not a broader category or related concept
   - If a translation is incorrect or semantically imprecise, this is a SEVERE error
   - Grammatical gender must be correct (masculine nouns with masculine articles, feminine with feminine)

3. ROMANIZATION (required field):
   - For Japanese, Chinese, Korean, Arabic, Russian, Greek, Thai, Hindi, etc.: romanization MUST contain the Roman letter representation
   - Use standard romanization (romaji for Japanese, pinyin for Chinese, etc.)
   - For Roman-script languages (Spanish, French, German, etc.): romanization MUST be null
   - Penalize if romanization is missing for non-Roman scripts or contains text for Roman scripts

4. TOPIC FOCUS (STRICT BOUNDARY ENFORCEMENT): Words must be INSIDE the lesson's specific scope. Penalize SEVERELY if:
   - Vocabulary includes words from adjacent but separate topics (e.g., adjectives when the lesson is about nouns)
   - Words drift to related but out-of-scope categories (e.g., wild animals for a pets lesson)
   - The output includes vocabulary that belongs in a DIFFERENT lesson on a related topic
   - Words are "helpful additions" that expand beyond the defined lesson boundary

5. VOCABULARY QUALITY: Words should be practical and commonly used. Penalize if:
   - Words are obscure, archaic, or rarely used in everyday speech
   - Words include profanity, slurs, or offensive content
   - Words use non-standard loanwords that are not common in the target language

6. LANGUAGE CORRECTNESS: Output language must match NATIVE_LANGUAGE code.
   - Translations should be in the learner's native language
   - Words being tested should be in the target language
   - Penalize if languages are mixed incorrectly

7. GRAMMATICAL GENDER AND ARTICLES:
   - For languages with grammatical gender, nouns MUST include articles
   - German: "die Mutter", "der Vater", "das Kind" (not "Mutter", "Vater", "Kind")
   - French: "le pain", "la maison" (not "pain", "maison")
   - Spanish: "el gato", "la casa" (not "gato", "casa")
   - Portuguese: "o livro", "a mesa" (not "livro", "mesa")
   - Italian: "il gatto", "la casa" (not "gatto", "casa")
   - Penalize if nouns are shown without their articles in gendered languages
   - Penalize if the grammatical gender is WRONG (e.g., masculine article with feminine noun)

8. NO DUPLICATES: The \`word\` field is the unique identifier - duplicates are determined by the word field ONLY, not translations. Penalize if:
   - The same word appears multiple times in the \`word\` field (even with different translations)
   - Near-duplicates exist (same word with minor formatting differences)
   - Semantic duplicates exist (same concept repeated with different phrasing)
   - A word appears twice because it has multiple valid translations (should appear once with most common translation)

9. CLEAN WORD FIELD - NO PARENTHETICAL CONTENT: The word field must contain ONLY the vocabulary word. Penalize SEVERELY if:
   - The word field contains parenthetical disambiguation like "el cafe (la bebida)"
   - The word field contains usage notes, alternative meanings, or pronunciation hints in parentheses
   - Any text in parentheses appears in the word field (this breaks text-to-speech)

10. NO OVER-ENUMERATION OF VARIANTS: Vocabulary should be representative, not exhaustive. Penalize if:
   - Multiple variants of the same base item are listed when 1-2 would suffice
   - The list appears inflated with excessive sub-types of a single category
   - A base concept is represented by 5+ specific variants instead of the base term plus 1-2 examples
   - The vocabulary count seems artificially high due to listing every possible variant
   NOTE: This does NOT mean penalize for having many words - penalize only when those words are redundant variants of the same concept. Distinct vocabulary items are fine.

11. ALTERNATIVE TRANSLATIONS: Each word should include alternativeTranslations with other valid translations in the learner's language.
   - Words with multiple common translations MUST list alternatives (e.g., "boa noite" should include ["good night"] when the main translation is "good evening")
   - Words with only one clear translation should have an empty array
   - Alternatives must be genuinely equivalent translations, not loosely related words
   - Consider bidirectional synonyms (e.g., if user language is Italian and "bye" = "ciao", then "hello" should be an alternative since it also means "ciao")

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific word choices - accept ANY valid vocabulary relevant to the topic
- Do NOT penalize for not including words you might expect - only penalize for actual errors
- Do NOT require specific vocabulary items by name
- Do NOT expect a specific number of words - narrow topics naturally have fewer words
- FOCUS ON: translation accuracy, romanization correctness (when applicable), topic relevance, no duplicates, clean word fields, alternative translations
- Different valid vocabulary selections exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Spanish vocabulary for ordering coffee - focused specifically on coffee drinks, sizes, milk options, and common cafe phrases.

SCRIPT: Roman (romanization should be null)

TOPIC SCOPE: This is a narrow, focused lesson. Vocabulary should include:
- Coffee drink types (espresso, latte, cappuccino, americano, etc.)
- Size options (small, medium, large)
- Milk options (with milk, without milk, oat milk, etc.)
- Basic ordering phrases (I would like, please, to go, for here)
- Do NOT expect general food vocabulary, restaurant vocabulary, or dining etiquette

ACCURACY PITFALLS - Penalize SEVERELY if:
- Coffee-specific terms are mistranslated
- Vocabulary drifts to general food/restaurant terms unrelated to coffee ordering
- Romanization contains any text (should be null)
- Articles are missing from nouns (el cafe, la leche, not cafe, leche)

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-ordering-coffee",
    userInput: {
      chapterTitle: "At the Cafe",
      lessonDescription:
        "Words and phrases for ordering coffee drinks, specifying sizes, and requesting milk options at a cafe",
      lessonTitle: "Ordering Coffee",
      targetLanguage: "Spanish",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: French vocabulary for breads and pastries - focused specifically on bakery items found in a French boulangerie/patisserie.

SCRIPT: Roman (romanization should be null)

TOPIC SCOPE: This is a narrow, focused lesson. Vocabulary should include:
- Types of bread (baguette, pain de campagne, brioche, etc.)
- Pastries (croissant, pain au chocolat, eclair, etc.)
- Related bakery terms (crust, crumb, fresh, etc.)
- Do NOT expect general food vocabulary, cooking terms, or restaurant vocabulary

ACCURACY PITFALLS - Penalize SEVERELY if:
- Bakery items are mistranslated
- Vocabulary drifts to general cooking or restaurant terms
- Gendered articles are missing (le pain, la baguette, not pain, baguette)
- Romanization contains any text (should be null)

${SHARED_EXPECTATIONS}
    `,
    id: "en-french-bakery-items",
    userInput: {
      chapterTitle: "French Cuisine",
      lessonDescription:
        "Names of breads, pastries, and baked goods commonly found in French bakeries",
      lessonTitle: "Breads and Pastries",
      targetLanguage: "French",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: German vocabulary for parents and siblings - focused specifically on immediate family members (mother, father, brother, sister, and their variations).

SCRIPT: Roman (romanization should be null)

TOPIC SCOPE: This is a narrow, focused lesson. Vocabulary should include:
- Parents (mother, father, mom, dad, step-parents)
- Siblings (brother, sister, half-siblings, step-siblings)
- Related terms (older, younger, twin, only child)
- Do NOT expect extended family (grandparents, aunts, uncles, cousins) - those belong in separate lessons

ACCURACY PITFALLS - Penalize SEVERELY if:
- Parent/sibling terms are mistranslated (Mutter=mother, Vater=father, Bruder=brother, Schwester=sister)
- Vocabulary includes extended family members (this lesson is specifically about parents and siblings)
- German articles (der/die/das) are missing from nouns
- Romanization contains any text (should be null)

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-parents-siblings",
    userInput: {
      chapterTitle: "Family",
      lessonDescription:
        "Words for parents, siblings, and immediate family relationships in German",
      lessonTitle: "Parents and Siblings",
      targetLanguage: "German",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required (NOT English).

TOPIC: Italian vocabulary for common pets - focused specifically on household pets and basic pet care terms.

SCRIPT: Roman (romanization should be null)

TOPIC SCOPE: This is a narrow, focused lesson. Vocabulary should include:
- Common household pets (dog, cat, fish, bird, hamster, rabbit, turtle, etc.)
- Basic pet-related terms (pet, owner, food bowl, leash, cage, etc.)
- Do NOT expect farm animals, wild animals, or zoo animals - those belong in separate lessons

ACCURACY PITFALLS - Penalize SEVERELY if:
- Pet names are mistranslated (il cane=cachorro/cao, il gatto=gato, etc.)
- Translations are semantically imprecise (e.g., translating a word for "puppy/cub" as "pet")
- Non-standard loanwords are used (e.g., using English "pet" as standalone Italian vocabulary)
- Vocabulary includes farm or wild animals (this lesson is specifically about pets)
- Output is in English instead of Portuguese
- Italian articles are missing from nouns (il cane, il gatto, not cane, gatto)
- Grammatical gender is incorrect (masculine article with feminine noun or vice versa)
- Romanization contains any text (should be null)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-italian-common-pets",
    userInput: {
      chapterTitle: "Animais",
      lessonDescription:
        "Nomes de animais de estimacao comuns e termos basicos relacionados a cuidados com pets",
      lessonTitle: "Animais de Estimacao",
      targetLanguage: "Italian",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Portuguese vocabulary for greetings and farewells - focused specifically on common ways to say hello, goodbye, and related social phrases.

SCRIPT: Roman (romanization should be null)

TOPIC SCOPE: This lesson specifically tests overlapping translations. Vocabulary should include:
- Greetings (oi, olá, bom dia, boa tarde, boa noite)
- Farewells (tchau, adeus, até logo, até mais)
- Related social phrases (tudo bem, como vai)
- Do NOT expect general conversation vocabulary beyond greetings and farewells

ALTERNATIVE TRANSLATIONS (CRITICAL FOR THIS TEST):
- This test specifically validates that overlapping translations are captured in alternativeTranslations
- "oi" and "olá" should cross-reference each other as alternatives (both mean "hi"/"hello")
- "boa noite" should have alternatives covering both "good evening" and "good night"
- "tchau" and "adeus" should reference each other as farewell alternatives
- Penalize SEVERELY if words with obvious overlapping translations have empty alternativeTranslations arrays

ACCURACY PITFALLS - Penalize SEVERELY if:
- Greeting/farewell terms are mistranslated
- Vocabulary drifts to general conversation terms unrelated to greetings
- Romanization contains any text (should be null)
- Words with multiple valid translations have empty alternativeTranslations arrays

${SHARED_EXPECTATIONS}
    `,
    id: "en-portuguese-greetings-farewells",
    userInput: {
      chapterTitle: "Social Basics",
      lessonDescription:
        "Common greetings, farewells, and social phrases in Portuguese including formal and informal variants",
      lessonTitle: "Greetings and Farewells",
      targetLanguage: "Portuguese",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required (NOT English).

TOPIC: Japanese vocabulary for basic colors - focused specifically on the primary and most common colors.

SCRIPT: Non-Roman (romanization MUST be included)

TOPIC SCOPE: This is a narrow, focused lesson about COLOR NOUNS ONLY. Vocabulary should include:
- Primary colors (red, blue, yellow)
- Common colors (green, orange, purple, pink, brown, black, white, gray)

SCOPE BOUNDARY (CRITICAL): This lesson is ONLY about color names (nouns). Penalize SEVERELY if:
- Color-modifying adjectives are included (words meaning bright, dark, light, vivid, pale, deep, etc.)
- Color-related phrases or compound words are included
- Any vocabulary that describes HOW a color appears rather than WHAT the color is

ROMANIZATION REQUIREMENTS:
- MUST include romaji for all Japanese words
- Standard romaji system (Hepburn or similar)
- Examples: 赤 → "aka", 青 → "ao", 緑 → "midori"

ACCURACY PITFALLS - Penalize SEVERELY if:
- Color names are mistranslated (赤=rojo, 青=azul, etc.)
- Vocabulary drifts to color-related adjectives or phrases
- Output is in English instead of Spanish
- Romanization is missing or incorrect

${SHARED_EXPECTATIONS}
    `,
    id: "es-japanese-basic-colors",
    userInput: {
      chapterTitle: "Describir Cosas",
      lessonDescription:
        "Los colores basicos en japones - rojo, azul, verde, amarillo, y otros colores comunes",
      lessonTitle: "Colores Basicos",
      targetLanguage: "Japanese",
      userLanguage: "es",
    },
  },
];
