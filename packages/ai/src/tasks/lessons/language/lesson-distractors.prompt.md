Generate distractor words for language-learning lessons.

You will receive:

- `INPUT`: a word or sentence
- `LANGUAGE`: the language of that text
- `SHAPE`:
  - `any`: return the safest natural distractors, which may be one word or multiple words
  - `single-word`: return exactly one-word distractors

Return a JSON object with exactly one field:

- `distractors`: an array of exactly 8 strings

## Semantic safety: reject any overlap with the input

The most important rule: **no distractor may overlap with ANY meaning of the input.** If a language teacher could accept a distractor as correct for any valid use of the input, it is unsafe and must be rejected.

Many words are polysemous — they carry multiple unrelated meanings. A greeting can double as a farewell. A noun can also be a verb. A concrete word can have figurative senses. You must identify ALL meanings of the input before evaluating candidates.

Check overlap in both directions: does any meaning of the **candidate** match any meaning of the **input**? Even if the candidate has other meanings that don't overlap, one overlapping sense is enough to reject.

### Process

1. **Enumerate all accepted meanings** of the input in simple English. Include every dictionary sense, informal use, slang, and pragmatic function (greeting, farewell, exclamation, etc.). A missed meaning is a missed rejection.

2. **Test each candidate.** For every meaning of the candidate, ask: "Does this overlap with any accepted meaning of the input? Could a teacher accept this as correct?" If yes for any pair of meanings → reject.

3. **Replace rejected candidates** with words from a clearly different semantic domain.

### Polysemy examples

INPUT: `Servus` (German)
All accepted meanings: `hello`, `hi`, `goodbye`, `bye`

- `Tschüss` → means `bye` → overlaps with `goodbye` → **reject**
- `Hallo` → means `hello/hi` → overlaps with `hello` → **reject**
- `Danke` → means `thank you` → no overlap → **allow**
- `Guten Morgen` → means `good morning` → specific, no overlap with general hello/goodbye → **allow**

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

### Why this matters

The fix is always the same: enumerate ALL meanings first, then test every candidate against the full list. This applies equally to polysemous inputs, words with informal senses, and words whose distractors have their own multiple meanings.

## Format rules

1. Every distractor must be in the same language as the input.
2. Follow `SHAPE` exactly.
3. For `single-word`, every distractor must be exactly one word.
4. For `any`, use the most natural safe form. If the input is multi-word, prefer full alternatives over fragments copied from the input.
5. Never return explanations, translations, glosses, definitions, romanizations, or mixed-language output.
6. Never return a distractor that is exactly the input.
7. Never return punctuation-only variants, casing-only variants, or near-duplicates.
8. Good distractors are near-miss contrasts from a different meaning space — close enough to be tempting, but clearly wrong for every valid use of the input.
9. If the input is a sentence and `SHAPE` is `single-word`, extract the meaning space from the sentence but still return only single-word distractors that would fit a word-bank style lesson.
10. For non-Roman scripts, keep the distractor text in the original script. Never romanize it.
11. Output only the JSON object.

## Good outputs

- INPUT: `libro azul`, LANGUAGE: Spanish, SHAPE: `any`
  `["coche azul","libro rojo","cuaderno azul","libro verde","mesa azul","revista roja","coche rojo","cuaderno verde"]`

- INPUT: `木`, LANGUAGE: Japanese, SHAPE: `any`
  `["花","草","葉","森","竹","枝","実","石"]`

- INPUT: `window`, LANGUAGE: English, SHAPE: `any`
  `["mirror","bucket","lantern","blanket","pillow","ladder","candle","curtain"]`

- INPUT: `La casa è grande.`, LANGUAGE: Italian, SHAPE: `single-word`
  `["strada","libro","tavolo","acqua","pane","finestra","scuola","caffè"]`

## Bad outputs

- INPUT: `Servus`, LANGUAGE: German, SHAPE: `any`
  `["Tschüss","Hallo"]` — `Servus` means both hello and goodbye, so `Tschüss` (bye) and `Hallo` (hello) both overlap with valid meanings

- INPUT: `libro azul`, LANGUAGE: Spanish, SHAPE: `any`
  `["azul"]` — `azul` is only a fragment of the input

- INPUT: `gracias`, LANGUAGE: Spanish, SHAPE: `any`
  `["muchas gracias","te lo agradezco"]` — both could still be accepted as correct

- INPUT: `La casa è grande.`, LANGUAGE: Italian, SHAPE: `single-word`
  `["molto bene"]` — not one word

- INPUT: `木`, LANGUAGE: Japanese, SHAPE: `any`
  `["き (ki)"]` — includes romanization
