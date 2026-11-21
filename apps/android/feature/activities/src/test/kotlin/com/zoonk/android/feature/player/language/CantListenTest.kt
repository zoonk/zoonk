package com.zoonk.android.feature.player.language

import com.zoonk.android.feature.player.engine.listeningInstead
import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.SpokenAnswerStepContent
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.api.ApiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** "I can't listen now": a sentence to hear stays quiet, and a spoken screen that can't be said or heard is typed. */
class CantListenTest {
    private val listening =
        ApiJson.decodeFromString(
            LanguageExercise.serializer(),
            """
            {"content":{},"fillBlankOptions":[],"id":"00000000-0000-4000-8000-000000000001","kind":"listening",
             "matchColumnsRightItems":[],"position":0,"readingPromptWords":[],
             "sentence":{"audioUrl":"$AUDIO","distractors":[],"explanation":null,"id":"s-1","ordersPending":false,
               "otherSentenceOrders":[],"otherTranslationOrders":[],"romanization":null,"sentence":"Tengo hambre.",
               "translation":"I'm hungry.","translationDistractors":[]},
             "sentenceWordOptions":[],"translationOptions":[],"vocabularyOptions":[],"word":null,"wordBankOptions":[]}
            """.trimIndent(),
        )

    private val listeningStep = LessonStep("hear", null, StepContent.Language(StepKind.Listening, listening, wordHints = null))

    private val spoken =
        StepContent.SpokenAnswer(
            SpokenAnswerStepContent(
                language = "es",
                prompt = "Say that you're hungry",
                targetText = "Tengo hambre",
                translation = "I'm hungry",
            ),
            listening = listening,
        )

    private val spokenStep = LessonStep("say", null, spoken)

    @Test
    fun aSentenceToHearPlaysUntilTheLearnerCantListen() {
        assertEquals(AUDIO, shownPromptUrl(listeningStep, cantTalk = false, cantListen = false))
        assertNull(shownPromptUrl(listeningStep, cantTalk = false, cantListen = true))
    }

    @Test
    fun aSpokenScreenIsHeardWhenTheLearnerCantTalkAndTypedWhenTheyCantListenEither() {
        assertEquals(StepKind.Listening, spoken.listeningInstead(cantTalk = true, cantListen = false)?.kind)
        assertEquals(AUDIO, shownPromptUrl(spokenStep, cantTalk = true, cantListen = false))

        assertNull(spoken.listeningInstead(cantTalk = true, cantListen = true))
        assertNull(shownPromptUrl(spokenStep, cantTalk = true, cantListen = true))

        assertNull(spoken.listeningInstead(cantTalk = false, cantListen = true))
    }

    private companion object {
        const val AUDIO = "https://audio.zoonk.test/sentence.mp3"
    }
}
