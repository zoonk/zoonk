package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.tutor.TutorScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LessonTutorTest {
    private fun play(
        steps: List<LessonStep>,
        vararg actions: LessonAction,
    ): LessonPlayerState = actions.fold(LessonPlayerState.initial("lesson", steps, now = 0)) { state, action -> reduce(state, action, 0) }

    @Test
    fun aMissedAnswerIsWhatTheBuddyIsAskedAboutAndWordsTheAsk() {
        val wrong = LessonAnswer.Check("wrong")
        val state =
            play(
                listOf(explanationStep("intro"), checkStep("quiz")),
                LessonAction.Continue,
                LessonAction.SelectAnswer("quiz", wrong),
                LessonAction.CheckResolved("quiz", stepResult(false), counts = true),
            )

        assertEquals(TutorScope.Answer("lesson", "quiz", 2, wrong.toApi()!!), state.tutorScope(state.screen()))
        assertTrue(state.showsMiss(state.screen()))
    }

    @Test
    fun anUncheckedAnswerAsksAboutTheScreen() {
        val state = play(listOf(checkStep("quiz")), LessonAction.SelectAnswer("quiz", LessonAnswer.Check("wrong")))

        assertEquals(TutorScope.Step("lesson", "quiz", 1), state.tutorScope(state.screen()))
        assertFalse(state.showsMiss(state.screen()))
    }

    @Test
    fun aHooksWrongGuessIsNoMiss() {
        val state =
            play(
                listOf(hookGuessStep("hook"), explanationStep("next")),
                LessonAction.SelectAnswer("hook", LessonAnswer.Hook("yes")),
                LessonAction.CheckResolved("hook", stepResult(false), counts = false),
            )

        assertEquals(TutorScope.Step("lesson", "hook", 1), state.tutorScope(state.screen()))
        assertFalse(state.showsMiss(state.screen()))
    }
}
