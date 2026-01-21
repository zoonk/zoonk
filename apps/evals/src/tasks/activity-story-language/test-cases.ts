const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STRUCTURE - IMMERSIVE STORY FORMAT (CRITICAL):
   The activity MUST follow the immersive story structure:
   - A clear scenario description in the NATIVE language
   - 5-10 dialogue steps with natural progression
   - Each step has: context (TARGET), contextTranslation (NATIVE), question (NATIVE), 4 options
   - Exactly 1 correct option per step
   Penalize SEVERELY if any structural element is missing or malformed.

2. SCENARIO QUALITY:
   - Scenario MUST describe a realistic everyday situation
   - Should be relevant to the lesson topic
   - Setting should be clear and immersive
   - Appropriate for language learners (not overly complex situations)
   Penalize if scenario is vague, unrealistic, or unrelated to the lesson.

3. CONTEXT DIALOGUE:
   - Context MUST be in the TARGET language
   - Context represents what the native speaker says
   - contextTranslation MUST accurately translate the context to NATIVE language
   - Dialogue should be natural, not stilted or textbook-like
   Penalize if context is unnatural or translation is inaccurate.

4. OPTIONS DESIGN (CRITICAL - IMMERSION PRINCIPLE):
   - Options MUST show only TARGET language text (NO translations)
   - All 4 options MUST be grammatically correct in TARGET language
   - Options should represent meaningfully different responses
   - textRomanization provided for non-Roman scripts, empty string for Roman scripts
   - Penalize SEVERELY if options include translations or hints in NATIVE language
   - Penalize if options are grammatically incorrect or nonsensical

5. FEEDBACK DESIGN (CRITICAL):
   - Every feedback MUST include the translation of what the learner said
   - Feedback MUST explain why the choice is correct or incorrect
   - For incorrect options: explain what would be better
   - Feedback is in NATIVE language
   - Penalize SEVERELY if feedback is missing translation
   - Penalize if feedback doesn't explain the reasoning

6. ROMANIZATION (CRITICAL):
   - For non-Roman scripts (Japanese, Korean, Chinese, Arabic, Russian, Greek, Thai, Hindi, etc.):
     BOTH contextRomanization AND textRomanization MUST be included and accurate
   - For Roman-script languages (Spanish, French, German, Portuguese, Italian, etc.):
     BOTH romanization fields MUST be empty strings ""
   - Penalize SEVERELY if romanization is missing for non-Roman scripts
   - Penalize SEVERELY if romanization contains text for Roman scripts

7. STORY ARC AND PROGRESSION:
   - Steps should follow a natural conversation flow
   - Story should have opening, building, complication (optional), resolution
   - Each step should logically follow from the previous
   - The native speaker should acknowledge the learner's previous choice
   Penalize if steps feel disconnected or conversation doesn't flow naturally.

8. LINGUISTIC ACCURACY (CRITICAL):
   - ALL target language text must be grammatically correct
   - ALL translations must be accurate and natural
   - Register (formal/informal) should be appropriate for the situation
   - Cultural context should be accurate
   Penalize SEVERELY for incorrect grammar, mistranslations, or inappropriate register.

9. DISTRACTOR QUALITY (CRITICAL):
   Wrong options MUST be genuinely wrong - they would cause miscommunication or confusion if used.

   GOOD distractors (genuinely wrong):
   - Answer a different question (asking about price when asked about quantity)
   - Request the wrong thing (one-way ticket when you need round-trip)
   - Are off-topic (asking for the check when you just arrived)
   - Would cause confusion (saying "no" when you mean "yes")

   BAD distractors (penalize these):
   - More/less formal versions of the correct answer that would still work
   - Slightly different phrasings that communicate the same thing
   - "Less polished" versions that a native speaker would still understand

   Example: If ordering coffee, "Where is the bathroom?" is a GOOD distractor (off-topic).
   "I would like your finest coffee" vs "A coffee please" are BOTH correct - don't use one as a distractor for the other.

   Penalize SEVERELY if distractors are just stylistic variations that would still accomplish the communication goal.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific dialogue choices - accept ANY natural conversation
- Do NOT require specific phrases or sentence structures
- Do NOT penalize for different valid cultural approaches
- FOCUS ON: structural correctness, immersion principle (no translations in options), feedback quality, romanization correctness
- The eval model should judge whether the activity creates an immersive language experience, not whether it matches predetermined answers
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE: English output required (scenario, questions, feedback).

TOPIC: Ordering coffee and pastries at a cafe in France.

SCRIPT: Roman (ALL romanization fields must be empty strings "")

SCENARIO TYPE: Food & Dining - casual cafe interaction

KEY REQUIREMENTS:
- Scenario describes arriving at a Parisian cafe
- Native speaker (barista/server) speaks natural French
- Learner must choose appropriate French phrases for ordering
- Options show ONLY French text, NO English translations
- Feedback reveals English translation + explanation

ACCURACY PITFALLS - Penalize SEVERELY if:
- Options include English translations or hints
- French dialogue is unnatural or overly formal for a cafe
- Romanization fields contain any text (must be empty string)
- Feedback doesn't include translation of what the learner said
- Steps don't follow a logical cafe interaction flow

${SHARED_EXPECTATIONS}
    `,
    id: "en-french-cafe-ordering",
    userInput: {
      chapterTitle: "At the Cafe",
      courseTitle: "French",
      language: "en",
      lessonDescription:
        "Practice ordering drinks and food at a French cafe, including asking for the menu and paying",
      lessonTitle: "Ordering at a Cafe",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Checking into a hotel in Japan.

SCRIPT: Non-Roman (romanization MUST be included for ALL Japanese text)

SCENARIO TYPE: Accommodation - hotel check-in interaction

KEY REQUIREMENTS:
- Scenario describes arriving at a hotel front desk
- Receptionist speaks polite Japanese (formal register appropriate for service)
- Learner must choose appropriate Japanese phrases for check-in
- Options show ONLY Japanese text with romanization, NO English
- Feedback reveals English translation + explanation

ROMANIZATION REQUIREMENTS:
- MUST include romaji for all Japanese text in context and options
- Standard Hepburn romanization system
- contextRomanization and textRomanization must be accurate

ACCURACY PITFALLS - Penalize SEVERELY if:
- Options include English translations
- Japanese is too casual for a hotel setting (should use です/ます forms)
- Romanization is missing or incorrect
- Feedback doesn't include translation
- Steps don't follow a logical hotel check-in sequence

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-hotel-checkin",
    userInput: {
      chapterTitle: "Travel and Accommodation",
      courseTitle: "Japanese",
      language: "en",
      lessonDescription:
        "Learn to check into a hotel, confirm reservations, and ask about room amenities",
      lessonTitle: "Hotel Check-in",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required (NOT English).

TOPIC: Buying groceries at a market in Germany.

SCRIPT: Roman (ALL romanization fields must be empty strings "")

SCENARIO TYPE: Shopping - grocery market interaction

KEY REQUIREMENTS:
- Scenario IN PORTUGUESE describes shopping at a German market
- Questions and feedback IN PORTUGUESE
- Vendor speaks natural German
- Learner must choose appropriate German phrases for shopping
- Options show ONLY German text, NO Portuguese translations

ACCURACY PITFALLS - Penalize SEVERELY if:
- Output is in English instead of Portuguese
- Options include Portuguese translations
- German dialogue is unnatural or uses overly formal register for a market
- Romanization fields contain any text (must be empty strings)
- Feedback (in Portuguese) doesn't include German translation
- Steps don't follow a logical shopping interaction

${SHARED_EXPECTATIONS}
    `,
    id: "pt-german-market-shopping",
    userInput: {
      chapterTitle: "Fazendo Compras",
      courseTitle: "German",
      language: "pt",
      lessonDescription:
        "Aprenda a comprar frutas, verduras e outros itens em um mercado alemao",
      lessonTitle: "No Mercado",
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required (NOT English).

TOPIC: Asking for directions in South Korea.

SCRIPT: Non-Roman (romanization MUST be included for ALL Korean text)

SCENARIO TYPE: Transportation - asking for directions

KEY REQUIREMENTS:
- Scenario IN SPANISH describes being lost and asking for directions
- Questions and feedback IN SPANISH
- Helpful local speaks natural Korean
- Learner must choose appropriate Korean phrases
- Options show ONLY Korean text with romanization, NO Spanish

ROMANIZATION REQUIREMENTS:
- MUST include romanization for all Korean text
- Use Revised Romanization of Korean
- Both contextRomanization and textRomanization must be accurate

ACCURACY PITFALLS - Penalize SEVERELY if:
- Output is in English instead of Spanish
- Options include Spanish translations
- Korean is inappropriate register (should use polite 요 forms for strangers)
- Romanization is missing or uses non-standard system
- Feedback (in Spanish) doesn't include Korean translation
- Steps don't follow a logical interaction for asking directions

${SHARED_EXPECTATIONS}
    `,
    id: "es-korean-asking-directions",
    userInput: {
      chapterTitle: "Transporte y Direcciones",
      courseTitle: "Korean",
      language: "es",
      lessonDescription:
        "Como pedir direcciones y entender indicaciones basicas en coreano",
      lessonTitle: "Pidiendo Direcciones",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Visiting a pharmacy in Spain with a minor ailment.

SCRIPT: Roman (ALL romanization fields must be empty strings "")

SCENARIO TYPE: Healthcare - pharmacy interaction

KEY REQUIREMENTS:
- Scenario describes needing medicine for a headache or cold
- Pharmacist speaks natural Spanish
- Learner must describe symptoms and ask for recommendations
- Options show ONLY Spanish text, NO English translations
- Feedback reveals English translation + explanation

COMPLICATION ELEMENT:
- Story should include a small complication (e.g., medicine unavailable, need prescription)
- Shows how to handle unexpected situations

ACCURACY PITFALLS - Penalize SEVERELY if:
- Options include English translations
- Spanish dialogue is unnatural
- Romanization fields contain any text (must be empty strings)
- Feedback doesn't include translation
- No complication or challenge in the story arc

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-pharmacy-visit",
    userInput: {
      chapterTitle: "Health and Wellness",
      courseTitle: "Spanish",
      language: "en",
      lessonDescription:
        "Learn to describe symptoms and buy medicine at a Spanish pharmacy",
      lessonTitle: "At the Pharmacy",
    },
  },
];
