package com.zoonk.android.feature.player.language

import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.SpokenMode
import com.zoonk.android.feature.player.engine.shownStep
import com.zoonk.android.feature.player.engine.spokenMode
import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.SpokenAnswerStepContent
import com.zoonk.android.feature.player.model.SpokenHeard
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.api.ApiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * "I can't listen now": a sentence to hear stays quiet, and a spoken screen that can't be said or heard is typed. An answered
 * spoken screen shows, plays and offers what it was answered with, whatever the day's choices are by the time the learner
 * goes back to it.
 */
class CantListenTest {
    private val listening =
        ApiJson.decodeFromString(
            LanguageExercise.serializer(),
            """
            {"content":{},"fillBlankOptions":[],"id":"00000000-0000-4000-8000-000000000001","kind":"listening",
             "matchColumnsRightItems":[],"position":0,"readingPromptWords":[],
             "sentence":{"audioUrl":"$AUDIO","distractors":[],"explanation":null,"id":"s-1","ordersPending":false,
               "otherSentenceOrders":[],"otherTranslationOrders":[],"readsItself":false,"romanization":null,"sentence":"Tengo hambre.",
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

    private val unanswered =
        LessonPlayerState("lesson", mapOf(listeningStep.id to listeningStep, spokenStep.id to spokenStep), listOf("say"))

    @Test
    fun aSentenceToHearPlaysUntilTheLearnerCantListen() {
        assertEquals(AUDIO, shownPromptUrl(listeningStep, unanswered, cantTalk = false, cantListen = false))
        assertNull(shownPromptUrl(listeningStep, unanswered, cantTalk = false, cantListen = true))
    }

    @Test
    fun aSpokenScreenIsHeardWhenTheLearnerCantTalkAndTypedWhenTheyCantListenEither() {
        assertEquals(SpokenMode.Listen, unanswered.spokenMode(spokenStep, cantTalk = true, cantListen = false))
        assertEquals(StepKind.Listening, unanswered.shownStep(spokenStep, cantTalk = true, cantListen = false).kind)
        assertEquals(AUDIO, shownPromptUrl(spokenStep, unanswered, cantTalk = true, cantListen = false))

        assertEquals(SpokenMode.Type, unanswered.spokenMode(spokenStep, cantTalk = true, cantListen = true))
        assertNull(shownPromptUrl(spokenStep, unanswered, cantTalk = true, cantListen = true))

        assertEquals(SpokenMode.Speak, unanswered.spokenMode(spokenStep, cantTalk = false, cantListen = true))
        assertEquals(SpokenMode.Type, unanswered.spokenMode(spokenStep, cantTalk = false, cantListen = false, micBlocked = true))
    }

    @Test
    fun aSpokenScreenAnsweredByEarStaysHeardOnceTheLearnerCanTalkAgain() {
        val heard = unanswered.copy(answers = mapOf("say" to LessonAnswer.Listening(listOf("I'm", "hungry."))))

        assertEquals(SpokenMode.Listen, heard.spokenMode(spokenStep, cantTalk = false, cantListen = false))
        assertEquals(StepKind.Listening, heard.shownStep(spokenStep, cantTalk = false, cantListen = false).kind)
        assertEquals(AUDIO, shownPromptUrl(spokenStep, heard, cantTalk = false, cantListen = false))
    }

    @Test
    fun aSpokenScreenSaidOutLoudStaysSaidOnceTheLearnerCantTalk() {
        val said =
            unanswered.copy(
                results = mapOf("say" to StepResult(isCorrect = true, heard = SpokenHeard("Tengo hambre", emptyList(), emptyList()))),
            )

        assertEquals(SpokenMode.Speak, said.spokenMode(spokenStep, cantTalk = true, cantListen = false))
        assertNull(shownPromptUrl(spokenStep, said, cantTalk = true, cantListen = false))
    }

    @Test
    fun aSpokenScreenTypedStaysTypedOnceTheLearnerCanTalkAgain() {
        val typed = unanswered.copy(answers = mapOf("say" to LessonAnswer.Spoken("Tengo hambre")))

        assertEquals(SpokenMode.Type, typed.spokenMode(spokenStep, cantTalk = false, cantListen = false))
        assertEquals(SpokenMode.Type, typed.spokenMode(spokenStep, cantTalk = true, cantListen = false))
    }

    private companion object {
        const val AUDIO = "https://audio.zoonk.test/sentence.mp3"
    }
}
