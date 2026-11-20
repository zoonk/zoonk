# Fix a lesson

How to fix any Library lesson: its plan, its screens, its words and sentences, and its map ideas. `pnpm zoonk staff models Lesson` prints each operation's rules and an example; this page says which one to use and how.

## Read it

`pnpm zoonk staff lesson <id> > lesson.json` prints everything a fix starts from:

- `version`: the screens' current version, the base a `setScreens` names.
- `plan`: the lesson plan, the brief Zoonk writes and repairs the screens from.
- `screens` in order: each one's `id`, `kind`, `content`, `skillId`, `ideaIndex`, and `variants` with each variant's `id` and full `content`. A word or sentence screen includes its `wordId` or `sentenceId` and text.
- `ideas`: the lesson map's ideas, by index.
- `words` and `sentences`: the lesson's rows (translation, distractors, note or explanation, accepted orders) with the shared text and whether it has audio.

## Choose the operation

- **One screen's words, answer key or options, a wrong picture to take off, or one word's translation:** the in-place operations in [fix operations](operations.md) (`Step` `set`, `setOptions`, `LessonWord` `set`…). They change the live screen, so learners mid-lesson see the fix at once.
- **The plan:** `Lesson` `setPlan`. Screens don't change.
- **Anything about which screens there are:** `Lesson` `setScreens`. Adding, removing, reordering or changing a screen's kind, adding or removing words and sentences, a new picture, a new numeric check, and adding, rewording or reordering map ideas.
- **A screen fix that corrects a fact the plan also states:** put a `setPlan` with the same correction in the same fix, or the next repair writes the error back.

## setPlan

Copy `plan` from `staff lesson`, change only what's wrong, and send the whole plan: `{ "model": "Lesson", "id": "<lesson id>", "setPlan": { …the whole plan… } }`. A new or renamed skill must be one linked to the lesson. The server keeps its planning fields and recomputes the estimate when screen kinds change.

## setScreens

`{ "model": "Lesson", "id": "<lesson id>", "setScreens": { "version", "screens", "words"?, "sentences"?, "ideas"? } }`. Start from `staff lesson` and send the final lesson:

- **`version`** is the one you read. If the lesson changed since, the check says which version to expect: read it again.
- **`screens`** is the final ordered list. `{ "id" }` keeps a screen as it is. Adding `content` (the whole screen), `variants`, `citation`, `mediaAssetId` or `idea` to it edits it. `{ "kind", … }` adds one. A screen you leave out is removed.
- **Words and sentences.** `vocabulary` and `translation` screens take `word`; `reading` and `listening` take `sentence`, and so may a `spokenAnswer`. The value is a lesson word's or sentence's id, or a `key` you declare. Leave `words` out to keep them as they are; send it and it's the final list: `{ "id" }` keeps a row, `{ "id", "translation"?, "distractors"?, "note"? }` edits it, and `{ "key", "word", "translation", "distractors", "note"? }` declares one. A declared sentence is `{ "key", "sentence", "translation", "explanation", "distractors", "translationDistractors", "otherSentenceOrders", "otherTranslationOrders" }`; the last two are the other word orders that are also right, which you review yourself (`[]` when there are none), and a new translation for a kept sentence needs its `otherTranslationOrders` too. Every row needs a screen and every word or sentence screen needs its row. Declared text that exists is reused with its audio; new text is recorded at proposal. A spelling fix for every lesson is a `Word` or `Sentence` `set`.
- **Map ideas.** A screen's `idea` is an index in the final ideas list (`null` clears it). Leave `ideas` out to keep them; send it and it's the final list: `{ "from": 2 }` keeps idea 2, `{ "from": 2, "text", "label" }` rewords it, and `{ "text", "label" }` adds one, with an icon drawn at proposal. Kept screens follow their idea wherever it moves.
- **Pictures.** `picture: { "prompt", "alt" }` on a screen draws a new one at proposal; `mediaAssetId` reuses one that exists.
- **A numeric check:** `{ "kind": "check", "skillId", "numeric": { "context", "question", "math", "correctReason" } }`. The question shows each `math` variable as `{name}`, each common mistake becomes a wrong option, and the screen's content comes from it. It also adds the question to practice.
- A question that quotes an earlier screen keeps quoting it when it moves; one whose quoted screen you removed is refused.

## Check, then propose

`pnpm zoonk staff fixes propose --check fix.json` prepares the fix without storing it. Exit 0 prints each change's `before` and `after`, its `effects`, and `media`: the clips, pictures and icons proposing will produce. Exit 2 lists every problem with its path, such as `setScreens.screens[3].word: …`; fix them all and check again. Then propose without `--check`. The media is produced after proposing, and the approver hears and sees it before approving.

A fix holds up to 10 review units. Each change, new word or sentence declaration, and newly generated clip, picture or idea icon counts one. Kept entries and reused media add no units. Two fixes can't change one lesson in the same batch, so a lesson that needs more goes in a second fix once the first is approved.

## What learners get

Approving a `setScreens` publishes a new version of the lesson's screens. Learners who open the lesson afterward get it; a learner mid-lesson finishes the version they started, and an answer to a screen whose word or sentence the fix removed or changed isn't counted against them. Saved answer explanations and tutor answers stay only on screens the fix didn't change. A removed numeric check's question retires from practice. A `setPlan` changes nothing learners see. A revert puts back the previous screens as another new version.

## Examples

**A wrong fact in the plan.** A law lesson's screens cite "art. 4º, § 2º", but one plan brief still says "(Lei nº 12.813/2013, art. 4º, § 1º)". Copy the plan, change `§ 1º` to `§ 2º` in that brief, and propose one `setPlan`.

**Missing words.** A Vietnamese tones lesson teaches only `ma` ("ghost") as a word, while its map already has ideas for `má` ("mom", rising tone) and `mà` ("but", falling tone). One `setScreens` keeps every screen, adds a vocabulary and a translation screen for each new word next to `ma`'s, marks them with their ideas, and declares the words. That uses 3 review units and up to 2 more for new recordings:

```json
{
  "version": 1,
  "screens": [
    { "id": "<ma vocabulary>" },
    { "kind": "vocabulary", "word": "ma-mom", "idea": 1 },
    { "kind": "vocabulary", "word": "ma-but", "idea": 2 },
    { "id": "<ma translation>" },
    { "kind": "translation", "word": "ma-mom", "idea": 1 },
    { "kind": "translation", "word": "ma-but", "idea": 2 },
    { "id": "<every other screen, in order>" }
  ],
  "words": [
    { "id": "<ma word id>" },
    {
      "key": "ma-mom",
      "word": "má",
      "translation": "mom",
      "distractors": ["ghost", "but", "rice"]
    },
    { "key": "ma-but", "word": "mà", "translation": "but", "distractors": ["ghost", "mom", "and"] }
  ]
}
```

The `idea` indexes are the ones `staff lesson` printed for those ideas.
