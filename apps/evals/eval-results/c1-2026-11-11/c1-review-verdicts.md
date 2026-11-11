# C1 lesson review: blind read verdicts

I read all 18 pairs: each lesson input and both A and B outputs. I did not open the key or any repository model output files. Screen numbers below are zero-based, the same as the review output.

**Tally:** A wins 2, B wins 3, ties 13.

## Planted and clean pairs (12): all ties

- **Planted errors (8):** both reviewers caught every one, with correct fixes:
  - wrong math
  - mismatched reason
  - two right options
  - worked-example trap
  - wrong summary
  - over-broad summary
  - case before shown
  - real-brand failure
- **Clean lessons (4):** both returned `[]`: temperature clean, numbered picture, regra clean, and jargon (which has a style issue but no factual error).
- **Neither reviewer made a false flag on these 12.** The only flaw is minor: some cross-references inside the problem text are one-based ("screens 3 and 8", "screen 4"). Every `screen` field is correct.

## Real lessons (6): this is where the reviewers differ

| Pair | Winner | Why |
|---|---|---|
| real-1-1 (linha de argumentação) | B | A returned nothing. B caught the summary's false universal "a regra vem antes", which contradicts the lesson's own rule that order matters only when one ground depends on another. B also showed that the processOrder activity on screen 7 rejects an equally valid fact → rule → consequence order. That is the weaker of B's two catches, but it is an answer-key issue, not style. |
| real-2-1 (LOA vs caixa) | A | A caught "sem permissão na LOA" (screen 6, repeated in the screen 10 feedback) as a false universal: the cited CF art. 167, II itself names "créditos ... adicionais". B returned nothing. |
| real-3-1 (proposições) | B | B caught the summary's "só vira proposição quando o valor de x é fixado" (quantifying x also yields a proposition). A returned nothing. |
| real-4-1 (federação/presidencialismo) | B | Both caught the impeachment-only exclusivity claim (screen 13, the summary, and the screen 15 option d feedback). B also caught that screen 15's feedback names Teresina, who appears nowhere in the lesson. A added a borderline unsupported flag on screen 5 (autonomy vs sovereignty wording). |
| real-5-1 (mobilidade) | A | Both caught the screen 2 guess: before odds are defined, "Diminui" and "Aumenta" are both defensible. A also caught "abrir mais vagas no topo ... sem tirar o peso da origem" (screen 7 and the summary) as a false universal. B missed that. |
| real-6-1 (conflito de interesses) | tie | Both returned `[]`. The legal citations and answer keys check out, so nothing was missed. |

## Unsupported flags

- **A, real-4-1, screen 5:** A flagged "Quem deve obediência a outra norma tem autonomia, não soberania" as false. In context it is the standard subordination test, so this is a wording objection. It's borderline, so I counted it as a false flag.
- **B:** none.

## Clear errors missed

- **A missed:**
  - real-1-1: the summary's universal "a regra vem antes", and the processOrder answer key
  - real-3-1: the summary's "só ... quando x é fixado"
  - real-4-1: Teresina appearing in feedback but nowhere in the lesson
- **B missed:**
  - real-2-1: LOA-only authorization
  - real-5-1: the "mais vagas" overgeneralization

## Takeaway

On planted errors and clean lessons the two reviewers can't be told apart. On real lessons each catches false universals the other misses. B is slightly ahead (3 to 2) and made no false flags, against A's one borderline flag. Neither result is decisive.
