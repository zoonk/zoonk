Generate distractor words for language-learning activities.

You will receive:

- `INPUT`: a word or sentence
- `LANGUAGE`: the language of that text
- `SHAPE`:
  - `any`: return the safest natural distractors, which may be one word or multiple words
  - `single-word`: return exactly one-word distractors

Return a JSON object with exactly one field:

- `distractors`: an array of exactly 8 strings

Rules:

1. Every distractor must be in the same language as the input.
2. Follow `SHAPE` exactly.
3. For `single-word`, every distractor must be exactly one word.
4. For `any`, use the most natural safe form. If the input is multi-word, prefer full alternatives over fragments copied from the input.
5. Never return explanations, translations, glosses, definitions, romanizations, or mixed-language output.
6. Never return a distractor that is exactly the input.
7. Never return punctuation-only variants, casing-only variants, or near-duplicates.
8. Never return distractors that could plausibly be correct under another common meaning, greeting usage, synonym, contraction, register shift, or polysemous reading.
9. If the input itself is highly polysemous without context, avoid distractors that depend on any specific interpretation. Prefer clearly wrong, less ambiguous output instead.
10. If the input is a sentence and `SHAPE` is `single-word`, extract the meaning space from the sentence but still return only single-word distractors that would fit a word-bank style activity.
11. Prefer plausible wrong answers that are similar in category, part of speech, or lesson context, but correctness safety is more important than cleverness.
12. For non-Roman scripts, keep the distractor text in the original script. Never romanize it.
13. Output only the JSON object.

Good outputs:

- INPUT: `boa noite`
  LANGUAGE: Portuguese
  SHAPE: `any`
  distractors: `["boa tarde","bom dia","até logo","até amanhã","boa viagem","boa sorte","bem-vindo","parabéns"]`
- INPUT: `猫`
  LANGUAGE: Japanese
  SHAPE: `any`
  distractors: `["犬","鳥","魚","馬","牛","象","虎","熊"]`
- INPUT: `you're welcome`
  LANGUAGE: English
  SHAPE: `any`
  distractors: `["please","sure thing","absolutely","certainly","of course","anytime","gladly","alright"]`
- INPUT: `money`
  LANGUAGE: English
  SHAPE: `any`
  distractors: `["mirror","bucket","lantern","blanket","pillow","ladder","candle","window"]`
- INPUT: `Guten Morgen, Anna!`
  LANGUAGE: German
  SHAPE: `single-word`
  distractors: `["Abend","Kaffee","Tisch","Schule","Fenster","Vater","Wasser","Brot"]`

Bad outputs:

- `["boa"]` for `boa noite` with `any` because it is a fragment of the input, not a safe full distractor
- `["good night"]` because that is the wrong language
- `["Guten Tag"]` for `single-word` because it is a phrase
- `["boa noite"]` because it repeats the input
- `["こんにちは (konnichiwa)"]` because it includes romanization
- `["hello"]` for `ciao` because that can still be correct
