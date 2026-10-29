package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import com.zoonk.android.feature.activities.choiceAnswer
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.ChallengeProgress
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.challengeProgress
import com.zoonk.android.feature.player.engine.pickChallengeChoice
import com.zoonk.android.feature.player.language.LanguageStepView
import com.zoonk.android.feature.player.language.LessonLanguage
import com.zoonk.android.feature.player.language.languageOptionAnswer
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue

/** What a screen's view can ask the player to do. */
@Stable
interface StepActions {
    fun select(answer: LessonAnswer?)

    /** The action bar's main action, for a field's Enter key. */
    fun runPrimary()

    fun dontKnow(stepId: String)

    fun skipWriting()

    fun explainFirst()

    /** The day's "I can't talk now", which types spoken screens instead. */
    val cantTalk: Boolean

    fun setCantTalk(chosen: Boolean)

    suspend fun gradeSpoken(
        stepId: String,
        recording: VoiceRecording,
    ): GradeOutcome<Unit>
}

/**
 * The one place a screen kind gets its view. A kind without one here ([isPlayable]) is left out
 * when the lesson can do without it, and otherwise the lesson doesn't open: the server finishes a
 * run only once every screen it needs has an answer.
 */
@Composable
fun StepView(
    step: LessonStep,
    state: LessonPlayerState,
    screen: LessonScreen,
    actions: StepActions,
    navigator: AppNavigator,
    language: LessonLanguage,
) {
    val answer = state.answers[step.id]
    val result = state.results[step.id]
    val locked = state.phase != LessonPhase.Playing

    when (val content = step.content) {
        is StepContent.Guess -> GuessHookView(step, content, answer, result, locked, actions)
        is StepContent.Fact -> FactHookView(step, content)
        is StepContent.Explanation -> ExplanationView(step, content)
        is StepContent.WorkedExample -> WorkedExampleView(step, content, revealed = state.revealed[step.id] ?: 1)
        is StepContent.Check -> CheckView(content, answer, result, locked, screen, actions)
        is StepContent.Summary -> SummaryView(content)
        is StepContent.TypedAnswer -> TypedAnswerView(step, content, answer, state, screen, actions)
        is StepContent.SpokenAnswer -> SpokenAnswerView(step, content, answer, state, actions, navigator)
        is StepContent.Activity -> ActivityView(step, content, answer, result, state, actions)
        is StepContent.Challenge -> ChallengeView(step, content, answer, result, state, actions)
        is StepContent.Language -> LanguageStepView(content, answer, result, locked, language, actions)
    }
}

fun isPlayable(step: LessonStep): Boolean =
    when (val content = step.content) {
        is StepContent.Activity -> content.isPlayable
        else -> true
    }

/** What a number key leaves picked: [answer] is null once pressing the pick again cleared it. */
@JvmInline
value class KeyPick(
    val answer: LessonAnswer?,
)

/** The pick a number key makes on a screen of options, a second press clearing it; null where keys pick nothing. */
fun keyPick(
    step: LessonStep,
    index: Int,
    state: LessonPlayerState,
): KeyPick? {
    val content = step.content
    if (content is StepContent.Challenge) {
        val progress =
            challengeProgress(
                content.content,
                state.answers[step.id],
                state.revealed[step.id] ?: 0,
            ) as? ChallengeProgress.Deciding
        val choice =
            progress
                ?.walk
                ?.node
                ?.choices
                ?.getOrNull(index) ?: return null
        return KeyPick(pickChallengeChoice(choice.id.takeUnless { it == progress.pendingChoiceId }, progress.confirmed))
    }

    val answer =
        when (content) {
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

            is StepContent.Activity -> {
                val picked =
                    activityRenderers[content.frame.template]?.keyPick?.invoke(content.content, index)
                        ?: (content.frame.check as? ChoiceCheckValue)
                            ?.value
                            ?.options
                            ?.getOrNull(index)
                            ?.let { choiceAnswer(it.id) }
                picked?.let(LessonAnswer::Activity)
            }

            is StepContent.Language -> {
                languageOptionAnswer(content, index)
            }

            else -> {
                null
            }
        } ?: return null

    return KeyPick(answer.takeUnless { it == state.answers[step.id] })
}
