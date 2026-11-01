package com.zoonk.android.feature.player.language

import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.api.ApiJson

// Language screens as the API sends them, for tests and review screenshots.

internal const val WORD = """{"audioUrl":null,"distractors":[],"id":"w-1","pronunciation":"/ˈɡato/","romanization":null,
    "translation":"cat","word":"gato"}"""

internal fun sentence(audioUrl: String?) =
    """{"audioUrl":${audioUrl?.let { "\"$it\"" } ?: "null"},"distractors":[],"explanation":null,"id":"s-1","romanization":null,
       "sentence":"Yo veo un gato.","translation":"I see a cat.","translationDistractors":[]}"""

internal fun bank(vararg words: String) =
    words.joinToString(",", "[", "]") {
        """{"audioUrl":null,"romanization":null,
    "translation":null,"word":"$it"}"""
    }

internal fun promptWords(vararg words: Pair<String, String?>) =
    words.joinToString(",", "[", "]") { (word, translation) ->
        """{"translation":${translation?.let { "\"$it\"" } ?: "null"},"word":"$word"}"""
    }

internal fun step(
    id: String,
    kind: StepKind,
    apiKind: String,
    content: String = "{}",
    word: String = "null",
    sentence: String = "null",
    wordBank: String = "[]",
    fillBlank: String = "[]",
    translations: String = "[]",
    rightItems: String = "[]",
    hints: String? = null,
    promptWords: String = "[]",
) = LessonStep(
    id,
    null,
    StepContent.Language(
        kind,
        ApiJson.decodeFromString(
            LanguageExercise.serializer(),
            """
            {"content":$content,"fillBlankOptions":$fillBlank,"id":"00000000-0000-4000-8000-000000000001","kind":"$apiKind",
             "matchColumnsRightItems":$rightItems,"position":0,"readingPromptWords":$promptWords,"sentence":$sentence,
             "sentenceWordOptions":[],"translationOptions":$translations,"vocabularyOptions":[],"word":$word,"wordBankOptions":$wordBank}
            """.trimIndent(),
        ),
        hints?.let {
            ApiJson.decodeFromString(
                com.zoonk.android.feature.player.model.WordHints
                    .serializer(),
                it,
            )
        },
    ),
)

internal fun reading(id: String) =
    step(
        id,
        StepKind.Reading,
        "reading",
        sentence = sentence(null),
        wordBank = bank("un", "Yo", "gato.", "veo"),
        promptWords = promptWords("I" to "Yo", "see" to "veo", "a" to "un", "cat." to "gato"),
    )

/** A sentence long enough to wrap the answer onto more lines on a phone, in the order it's built. */
internal val LONG_SENTENCE = listOf("The", "common", "thread", "in", "my", "experience", "is", "improving", "processes")

internal fun longReading(id: String) =
    step(
        id,
        StepKind.Reading,
        "reading",
        sentence =
            """{"audioUrl":null,"distractors":[],"explanation":null,"id":"s-2","romanization":null,
               "sentence":"${LONG_SENTENCE.joinToString(" ")}",
               "translation":"O fio condutor da minha experiência é melhorar processos","translationDistractors":[]}""",
        wordBank = bank("in", "common", "processes", "my", "improves", "am", "experience", "The", "those", "thread", "is", "improving"),
        promptWords = promptWords(*"O fio condutor da minha experiência é melhorar processos".split(" ").map { it to null }.toTypedArray()),
    )

internal fun listening(
    id: String,
    audioUrl: String?,
) = step(id, StepKind.Listening, "listening", sentence = sentence(audioUrl), wordBank = bank("cat.", "I", "see", "a"))

internal fun fillBlank(id: String) =
    step(
        id,
        StepKind.FillBlank,
        "fillBlank",
        content = """{"answers":["pay"],"distractors":["rent"],"feedback":"You pay rent.","question":"Fill in the blank",
            "template":"I [BLANK] rent."}""",
        fillBlank = bank("rent", "pay"),
    )

internal fun matchColumns(id: String) =
    step(
        id,
        StepKind.MatchColumns,
        "matchColumns",
        content = """{"pairs":[{"left":"hola","right":"hello"},{"left":"gato","right":"cat"}]}""",
        rightItems = """["cat","hello"]""",
    )

internal fun vocabulary(id: String) =
    step(id, StepKind.Vocabulary, "vocabulary", word = WORD, hints = """{"note":"You say it to a cat.","pronunciationTip":null}""")

internal fun translation(
    id: String,
    hints: String? = null,
    gatoAudio: String? = null,
) = step(
    id,
    StepKind.Translation,
    "translation",
    word = WORD,
    translations = """[{"audioUrl":null,"id":"w-2","romanization":null,"word":"perro"},{"audioUrl":${gatoAudio?.let {
        "\"$it\""
    }},"id":"w-1",
        "romanization":"ga-to","word":"gato"}]""",
    hints = hints,
)

internal fun multipleChoice(
    id: String,
    image: String? = null,
) = step(
    id,
    StepKind.MultipleChoice,
    "multipleChoice",
    content =
        """{"options":[{"feedback":"Yes.","id":"bed","isCorrect":true,"text":"On the bed"},{"feedback":"No.","id":"sofa",
            "isCorrect":false,"text":"On the sofa"}],
           "question":"Where is the cat?"${image?.let { ""","image":$it""" }.orEmpty()}}""",
)

internal fun alphabet(id: String) =
    step(
        id,
        StepKind.Alphabet,
        "alphabet",
        content = """{"audioText":"eñe","audioUrl":null,"forms":[{"label":"Capital","symbol":"Ñ"}],
            "pronunciation":"like ny in canyon","readingAid":"enye","symbol":"ñ"}""",
    )
