Generate distractor words for language-learning lessons.

# Shape rules

- `any`: return the safest natural distractors, which may be one word or multiple words
- `single-word`: return exactly one-word distractors

## Semantic safety: reject any overlap with the input

The most important rule: **no distractor may overlap with ANY meaning of the input.** If a language teacher could accept a distractor as correct for any valid use of the input, it is unsafe and must be rejected.

Many words are polysemous — they carry multiple unrelated meanings. A greeting can double as a farewell. A noun can also be a verb. A concrete word can have figurative senses. You must identify ALL meanings of the input before evaluating candidates.

Check overlap in both directions: does any meaning of the **candidate** match any meaning of the **input**? Even if the candidate has other meanings that don't overlap, one overlapping sense is enough to reject.

### Translation-answer safety

These distractors are often shown as answer options in translation drills. The learner may see the input's translation in their own language and choose between target-language options. That means a candidate is unsafe if it could be a valid answer to the same translated prompt, even when the candidate and input are not exact synonyms in `LANGUAGE`.

When `TRANSLATION` is provided, it is the learner-visible prompt for `INPUT`. Do not return a candidate that could also be a valid translation of `TRANSLATION`; the learner would have no fair way to know which answer is expected.

Example:

INPUT: `bonsoir` (French)
TRANSLATION: `boa noite` (Portuguese)

- `bonne nuit` → also translates to `boa noite`; the prompt does not show enough context to choose between the two French answers → **reject**
- `bonjour` → means `bom dia`, clearly different → **allow**
- `merci` → means `obrigado`, clearly different → **allow**

Reject candidates that commonly collapse to the same translation in another language, or that need extra context to distinguish from the input. This is especially important for greetings, farewells, politeness formulas, pronouns, verbs, aspect, register, and literal-vs-idiomatic phrases.

If a learner would need missing context to know whether the input or candidate is expected, the candidate is not a safe distractor.

### Plausibility: stay in the same lesson domain

Safe does not mean random. Distractors must stay in the same broad lesson domain, part of speech, and expression type as the input whenever possible.

For greetings, farewells, and social formulas, use other greetings, farewells, or social formulas that are clearly wrong for the prompt. Do not switch to random objects.

For verbs, use other verbs. For pronouns, use other pronouns. For nouns, use nearby nouns from the same practical category. A distractor should feel like it belongs in the same exercise, but it must still be wrong for every valid meaning and every likely translated prompt.

### Process

1. **Enumerate all accepted meanings** of the input in simple English. Include every dictionary sense, informal use, slang, and pragmatic function (greeting, farewell, exclamation, etc.). A missed meaning is a missed rejection.

2. **Test each candidate.** For every meaning of the candidate, ask: "Does this overlap with any accepted meaning of the input? Could a teacher accept this as correct? Could both the input and candidate answer the same translated prompt in another language without extra context?" If yes for any pair of meanings → reject.

3. **Replace rejected candidates** with safe nearby alternatives from the same lesson domain. Move only far enough away to make the candidate clearly wrong; do not drift into unrelated categories.

### Polysemy examples

INPUT: `Servus` (German)
All accepted meanings: `hello`, `hi`, `goodbye`, `bye`

- `Tschüss` → means `bye` → overlaps with `goodbye` → **reject**
- `Hallo` → means `hello/hi` → overlaps with `hello` → **reject**
- `Danke` → means `thank you` → no overlap → **allow**
- `Guten Morgen` → means `good morning` → specific, no overlap with general hello/goodbye → **allow**
- `Fenster` → means `window` → safe but unrelated to greeting practice → **reject**

INPUT: `right` (English)
All accepted meanings: `correct/accurate`, `direction opposite of left`, `morally good/just`, `entitlement`

- `true` → overlaps with `correct` (`that's right` ≈ `that's true`) → **reject**
- `fair` → has multiple meanings, but `just/equitable` sense overlaps with `morally good` → **reject** (one overlapping sense is enough, even though `fair` also means `carnival`)
- `left` → opposite direction, not a meaning of `right` → **allow**
- `heavy` → no overlap with any meaning → **allow**

INPUT: `배` (Korean)
All accepted meanings: `ship/boat`, `stomach/belly`, `pear`

- `선박` → means `vessel/ship` → overlaps with `ship/boat` → **reject**
- `복부` → means `abdomen` → overlaps with `stomach/belly` → **reject**
- `사과` → means `apple` → different fruit, no overlap → **allow**
- `의자` → means `chair` → no overlap → **allow**

INPUT: `saber` (Spanish)
Potential translated prompt in English: `to know`

- `conocer` → also translates to `to know`; the prompt needs context to choose the right Spanish verb → **reject**
- `preguntar` → means `to ask`, clearly different → **allow**
- `leer` → means `to read`, clearly different → **allow**
- `recordar` → means `to remember`, related but not a valid translation of `to know` → **allow**

INPUT: `tu` (French)
Potential translated prompt in English: `you`

- `vous` → also translates to `you`; formality is missing from the prompt → **reject**
- `il` → means `he`, clearly different → **allow**
- `nous` → means `we`, clearly different → **allow**

INPUT: `Good morning` (English)

- `Good afternoon` → same greeting category, clearly different time of day → **allow**
- `Good evening` → same greeting category, clearly different time of day → **allow**
- `Thank you` → same social-formula lesson domain, clearly wrong → **allow**
- `blue jacket` → unrelated object phrase, not a plausible greeting distractor → **reject**

### Why this matters

The fix is always the same: enumerate ALL meanings first, then test every candidate against the full list and against likely translated prompts. This applies equally to polysemous inputs, words with informal senses, words whose distractors have their own multiple meanings, and language pairs where distinct target-language forms share the same learner-language translation.

## Distractor rules

1. Every distractor must be in the same language as the input.
2. Follow `SHAPE` exactly.
3. For `single-word`, every distractor must be exactly one word.
4. For `any`, use the most natural safe form. If the input is multi-word, prefer full alternatives over fragments copied from the input.
5. Never return explanations, translations, glosses, definitions, romanizations, or mixed-language distractors.
6. Never return a distractor that is exactly the input.
7. Never return punctuation-only variants, casing-only variants, or near-duplicates.
8. Good distractors are near-miss contrasts from a different meaning space — close enough to be tempting, but clearly wrong for every valid use of the input.
9. If the input is a sentence and `SHAPE` is `single-word`, extract the meaning space from the sentence but still return only single-word distractors that would fit a word-bank style lesson.
10. For non-Roman scripts, keep the distractor text in the original script. Never romanize it.
11. Never return a candidate that could be accepted for the same translated prompt as the input without extra context.
12. Never use unrelated random objects, colors, places, or attributes when the input is a greeting, verb, pronoun, social formula, or another clear lesson category.

## Good distractor sets

- INPUT: `libro azul`, LANGUAGE: Spanish, SHAPE: `any`
  `["coche azul","libro rojo","cuaderno azul","libro verde","mesa azul","revista roja","coche rojo","cuaderno verde"]`

- INPUT: `木`, LANGUAGE: Japanese, SHAPE: `any`
  `["花","草","葉","森","竹","枝","実","石"]`

- INPUT: `window`, LANGUAGE: English, SHAPE: `any`
  `["mirror","bucket","lantern","blanket","pillow","ladder","candle","curtain"]`

- INPUT: `La casa è grande.`, LANGUAGE: Italian, SHAPE: `single-word`
  `["strada","libro","tavolo","acqua","pane","finestra","scuola","caffè"]`

## Bad distractor sets

- INPUT: `Servus`, LANGUAGE: German, SHAPE: `any`
  `["Tschüss","Hallo"]` — `Servus` means both hello and goodbye, so `Tschüss` (bye) and `Hallo` (hello) both overlap with valid meanings

- INPUT: `libro azul`, LANGUAGE: Spanish, SHAPE: `any`
  `["azul"]` — `azul` is only a fragment of the input

- INPUT: `gracias`, LANGUAGE: Spanish, SHAPE: `any`
  `["muchas gracias","te lo agradezco"]` — both could still be accepted as correct

- INPUT: `saber`, LANGUAGE: Spanish, SHAPE: `any`
  `["conocer"]` — both can answer a translated prompt like English `to know` without extra context

- INPUT: `Good morning`, LANGUAGE: English, SHAPE: `any`
  `["blue jacket","coffee table","red bicycle"]` — safe by meaning but unrelated to greeting practice

- INPUT: `La casa è grande.`, LANGUAGE: Italian, SHAPE: `single-word`
  `["molto bene"]` — not one word

- INPUT: `木`, LANGUAGE: Japanese, SHAPE: `any`
  `["き (ki)"]` — includes romanization
