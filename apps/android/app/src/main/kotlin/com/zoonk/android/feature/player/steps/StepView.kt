package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent

/** What a screen's view can ask the player to do. */
@Stable
interface StepActions {
    fun select(answer: LessonAnswer?)

    /** The action bar's main action, for a field's Enter key. */
    fun runPrimary()

    fun dontKnow(stepId: String)

    fun skipWriting()

    fun explainFirst()
}

/**
 * The one place a screen kind gets its view: a kind without one here is left out of the lesson
 * ([isPlayable]), as Apple's player does, so the learner never meets a screen they can't answer.
 */
@Composable
fun StepView(
    step: LessonStep,
    state: LessonPlayerState,
    screen: LessonScreen,
    actions: StepActions,
) {
    val answer = state.answers[step.id]
    val result = state.results[step.id]
    val locked = state.phase != LessonPhase.Playing

    when (val content = step.content) {
        is StepContent.Guess -> GuessHookView(step, content, answer, result, locked, actions)
        is StepContent.Fact -> FactHookView(step, content)
        is StepContent.Explanation -> ExplanationView(step, content)
        is StepContent.WorkedExample -> WorkedExampleView(content, revealed = state.revealed[step.id] ?: 1)
        is StepContent.Check -> CheckView(content, answer, result, locked, screen, actions)
        is StepContent.Summary -> SummaryView(content)
        is StepContent.TypedAnswer -> TypedAnswerView(step, content, answer, state, screen, actions)
        is StepContent.Activity, is StepContent.Challenge, is StepContent.SpokenAnswer, is StepContent.Language -> Unit
    }
}

fun isPlayable(step: LessonStep): Boolean =
    when (step.content) {
        is StepContent.Activity, is StepContent.Challenge, is StepContent.SpokenAnswer, is StepContent.Language -> false
        else -> true
    }

/** The answer a number key picks on a screen of options; null where keys pick nothing. */
fun optionAnswer(
    step: LessonStep,
    index: Int,
): LessonAnswer? =
    when (val content = step.content) {
        is StepContent.Check -> {
            content.content.options
                .getOrNull(index)
                ?.let { LessonAnswer.Check(it.id) }
        }

        is StepContent.Guess -> {
            content.content.options
                .getOrNull(index)
                ?.let { LessonAnswer.Hook(it.id) }
        }

        else -> {
            null
        }
    }
