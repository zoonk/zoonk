package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.Dp
import com.zoonk.android.data.Resource
import com.zoonk.android.feature.activities.choiceAnswer
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.ChallengeProgress
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.challengeProgress
import com.zoonk.android.feature.player.engine.isRequiredPictureDrawing
import com.zoonk.android.feature.player.engine.lessonMap
import com.zoonk.android.feature.player.engine.pickChallengeChoice
import com.zoonk.android.feature.player.language.LanguageStepView
import com.zoonk.android.feature.player.language.LessonLanguage
import com.zoonk.android.feature.player.language.languageOptionAnswer
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue

/** The action bar's main button, for a screen that hands it keyboard focus once its answer is complete. */
val LocalPrimaryFocus = staticCompositionLocalOf<FocusRequester?> { null }

/** How tall a screen's one column shows at once; null where the screen isn't in one column. */
val LocalStepViewHeight = compositionLocalOf<Dp?> { null }

/**
 * "I didn't get this" on a knowledge lesson's explanation, beside the buddy's face ([look], null
 * until the learner's buddy is known): opens the buddy on the screen, already asking it to explain
 * it more simply; null where the buddy can't be asked.
 */
@Immutable
class AskSimpler(
    val look: BuddyLook?,
    val ask: () -> Unit,
)

val LocalAskSimpler = compositionLocalOf<AskSimpler?> { null }

/** What a screen's view can ask the player to do. */
@Stable
interface StepActions {
    fun select(answer: LessonAnswer?)

    /** A number key's pick: through the view's own pick when it took the keys, so a key does what a tap does. */
    fun pickByKey(answer: LessonAnswer?) = select(answer)

    /** A view whose pick does more than select (a translation says its word) takes the number keys while it shows. */
    fun takeKeyPicks(pick: ((LessonAnswer?) -> Unit)?) = Unit

    /** A canvas whose number keys act on its own state (categorize's groups) takes them while it shows, saying whether a key did anything. */
    fun takeNumberKeys(keys: ((Int) -> Boolean)?) = Unit

    /** The number key at [index] for the canvas that took the keys; false when none did or the key did nothing. */
    fun pressNumberKey(index: Int): Boolean = false

    /** The action bar's main action, for a field's Enter key. */
    fun runPrimary()

    fun dontKnow(stepId: String)

    fun skipWriting()

    fun explainFirst()

    /** The day's "I can't talk now", which types spoken screens instead. */
    val cantTalk: Boolean

    fun setCantTalk(chosen: Boolean)

    /** The day's "I can't listen now", which shows a sound to find by ear as its notes. */
    val cantListen: Boolean

    fun setCantListen(chosen: Boolean)

    suspend fun gradeSpoken(
        stepId: String,
        recording: VoiceRecording,
    ): GradeOutcome<Unit>

    /** The learner's own example on an explanation screen; null while the lesson's examples are being written. */
    fun exampleLine(stepId: String): Resource<String>?
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
    part: StepPart,
) {
    val answer = state.answers[step.id]
    val result = state.results[step.id]
    val locked = state.phase != LessonPhase.Playing || step.isRequiredPictureDrawing
    // Language lessons keep their look; a knowledge lesson's screens read the map its strip and opening draw.
    val marking = if (language.languages.isLanguageLesson) null else LessonMarking(state.lessonMap?.map)

    CompositionLocalProvider(LocalStepChecked provides (state.phase == LessonPhase.Feedback)) {
        when (val content = step.content) {
            is StepContent.Guess -> GuessHookView(step, content, answer, result, locked, actions, part, marking)
            is StepContent.Fact -> FactHookView(step, content, part, marking)
            is StepContent.Explanation -> ExplanationView(step, content, actions, part, marking)
            is StepContent.WorkedExample -> WorkedExampleView(step, content, revealed = state.revealed[step.id] ?: 1, part, marking)
            is StepContent.Check -> CheckView(content, answer, result, locked, screen, actions, part, marking)
            is StepContent.Summary -> if (part.showsScreen) SummaryView(content)
            is StepContent.Map -> if (part.showsScreen) LessonMapStepView(content)
            is StepContent.TypedAnswer -> TypedAnswerView(step, content, answer, state, screen, actions, part, marking)
            is StepContent.SpokenAnswer -> SpokenAnswerView(step, content, answer, state, actions, navigator, language, part)
            is StepContent.Activity -> ActivityView(step, content, answer, result, state, actions, part)
            is StepContent.Challenge -> ChallengeView(step, content, answer, result, state, actions, part)
            is StepContent.Language -> LanguageStepView(content, answer, result, locked, language, actions, part)
        }
    }

    if (part.showsScreen) step.citation?.let { LessonCitation(it) }
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

/** The pick a number key makes on a screen of options, a second press clearing it except a translation's; null where keys pick nothing. */
fun keyPick(
    step: LessonStep,
    index: Int,
    state: LessonPlayerState,
): KeyPick? {
    if (step.isRequiredPictureDrawing) return null

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

    val keepsPick = answer is LessonAnswer.Translation
    return KeyPick(answer.takeUnless { !keepsPick && it == state.answers[step.id] })
}
