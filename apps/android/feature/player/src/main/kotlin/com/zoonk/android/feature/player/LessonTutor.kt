package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.IntState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import com.zoonk.android.R
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.lessonStepIds
import com.zoonk.android.feature.player.engine.strugglePauseMs
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.tutor.TutorAvatar
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.feature.tutor.TutorOffer
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.feature.tutor.TutorSuggestion
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.api.models.LessonTutorSuggestion
import kotlinx.coroutines.delay

/**
 * The buddy beside a lesson: who it is, the lesson's suggestions, whether the learner can ask it (a
 * guest can't yet, so nothing offers it beside a screen), and its ask button, whose conversation shows
 * while `open`, taking [offer] once: in its composer, or asked at once.
 */
@Immutable
class LessonTutor(
    val identity: TutorIdentity,
    val suggestions: List<TutorSuggestion> = emptyList(),
    val canAsk: Boolean = true,
    val askButton: @Composable (
        scope: TutorScope,
        worded: Boolean,
        open: Boolean,
        offer: TutorOffer?,
        onOfferTaken: () -> Unit,
        onOpenChange: (Boolean) -> Unit,
    ) -> Unit,
)

enum class BuddyOfferReason { Misses, Pause }

internal val SIMPLER_SUGGESTION = LessonTutorSuggestion.Id.SIMPLER.value

/** Main's `AskBuddyOffer`: after two misses on one idea, or a long pause on an explanation. */
@Composable
internal fun AskBuddyOffer(
    reason: BuddyOfferReason,
    identity: TutorIdentity,
    onAsk: () -> Unit,
    onDismiss: () -> Unit,
) {
    val message = if (reason == BuddyOfferReason.Misses) R.string.player_offer_tricky else R.string.player_offer_taking_time

    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider()
        Text(stringResource(message, identity.name), style = MaterialTheme.typography.bodyMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onAsk) {
                if (identity.look !=
                    null
                ) {
                    TutorAvatar(identity, ButtonDefaults.IconSize, Modifier.padding(end = ButtonDefaults.IconSpacing))
                }
                Text(stringResource(R.string.tutor_ask, identity.name))
            }
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.player_offer_no_thanks)) }
        }
    }
}

/**
 * Main's aside beside a teaching screen on wide screens, on the learner's page of a spread: two of the
 * buddy's suggestions for the screen, ready to send, or anything else.
 */
@Composable
internal fun ScreenHelp(
    tutor: LessonTutor,
    onAsk: (TutorSuggestion?) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                painterResource(R.drawable.ic_contact_support),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                stringResource(R.string.tutor_ask_screen, tutor.identity.name),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tutor.suggestions.take(SCREEN_SUGGESTIONS).forEach { suggestion ->
                SuggestionChip(onClick = { onAsk(suggestion) }, label = { Text(suggestion.label) })
            }
            SuggestionChip(onClick = { onAsk(null) }, label = { Text(stringResource(R.string.player_ask_something_else)) })
        }
    }
}

private const val SCREEN_SUGGESTIONS = 2

/** Text that teaches, which the buddy can explain another way: an explanation, a hook's fact, or the lesson's map. */
internal val LessonStep.teachesInText: Boolean
    get() = content is StepContent.Explanation || content is StepContent.Fact || content is StepContent.Map

/** Main's struggle pause: no press, scroll or key on an explanation for its pause while the app shows. */
@Composable
internal fun StrugglePause(
    step: LessonStep,
    position: Int,
    touches: IntState,
    offer: @Composable () -> Unit,
) {
    val pause = remember(step) { step.strugglePauseMs() } ?: return
    var stuck by rememberSaveable(step.id, position) { mutableStateOf(false) }
    val shown =
        LocalLifecycleOwner.current.lifecycle
            .currentStateAsState()
            .value
            .isAtLeast(Lifecycle.State.STARTED)
    val touched = touches.intValue

    LaunchedEffect(step.id, position, touched, shown) {
        if (shown && !stuck) {
            delay(pause)
            stuck = true
        }
    }

    if (stuck) offer()
}

/** What the buddy is asked about on [screen]: the learner's checked answer, the screen, or the lesson before its first screen. */
internal fun LessonPlayerState.tutorScope(screen: LessonScreen): TutorScope {
    val step = screen.step?.takeUnless { it.kind == StepKind.Map } ?: return TutorScope.Lesson(lessonId, lessonStepIds)
    val number = position + 1
    val checked = answers[step.id]?.takeIf { phase == LessonPhase.Feedback && step.id in results }?.toApi()
    return if (checked != null) TutorScope.Answer(lessonId, step.id, number, checked) else TutorScope.Step(lessonId, step.id, number)
}

/** Main's miss, which words the ask button: a checked answer shown wrong, never a hook's guess. */
internal fun LessonPlayerState.showsMiss(screen: LessonScreen): Boolean {
    val step = screen.step ?: return false
    return phase == LessonPhase.Feedback && results[step.id]?.isCorrect == false && step.content.kind != StepKind.Hook
}
