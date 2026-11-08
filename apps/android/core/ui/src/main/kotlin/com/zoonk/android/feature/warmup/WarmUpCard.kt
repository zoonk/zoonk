package com.zoonk.android.feature.warmup

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.progress
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.GenerationFailureNotice
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.focusMoveTarget
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.api.models.WarmUpDeck
import com.zoonk.api.models.WarmUpDeckCardsInner
import com.zoonk.api.models.WarmUpDeckCardsInnerOptionsInner

@Stable
class WaitQuizState internal constructor(
    val warmUpId: String?,
    private val warmUps: WarmUpStore?,
    index: Int,
    picked: String? = null,
    showingProgress: Boolean,
    visitedQuiz: Boolean = !showingProgress,
    shown: Boolean = false,
) {
    var index by mutableIntStateOf(index)
        private set
    var picked by mutableStateOf(picked)
        private set
    var showingProgress by mutableStateOf(showingProgress)
        private set
    var visitedQuiz by mutableStateOf(visitedQuiz)
        private set
    var shown by mutableStateOf(shown)
        internal set
    var deck by mutableStateOf<WarmUpDeck?>(null)
        internal set
    val card get() = deck?.cards?.getOrNull(index)
    val hasQuiz get() = card != null
    val hasNext get() = picked != null && (warmUpId?.let { warmUps?.next(it) } ?: Int.MAX_VALUE) < (deck?.cards?.size ?: 0)

    fun showProgress(hold: ReadyHold) {
        hold.guess()
        showingProgress = true
    }

    fun showQuiz(hold: ReadyHold) {
        hold.guess()
        showingProgress = false
        visitedQuiz = true
    }

    fun back() {
        showingProgress = false
    }

    fun pick(
        option: WarmUpDeckCardsInnerOptionsInner,
        hold: ReadyHold,
    ) {
        picked = option.id
        warmUpId?.let { warmUps?.answered(it, index) }
        hold.guess()
    }

    fun next() {
        index = warmUpId?.let { warmUps?.next(it) } ?: index + 1
        picked = null
    }
}

@Composable
fun rememberWaitQuiz(
    warmUpId: String?,
    warmUps: WarmUpStore?,
): WaitQuizState {
    val loaded =
        if (warmUpId != null && warmUps != null) {
            val read by warmUps.decks[warmUpId].collectShown()
            read.value
        } else {
            null
        }
    val saver =
        remember(warmUpId, warmUps) {
            listSaver<WaitQuizState, Any>(
                save = { listOf(it.index, it.picked.orEmpty(), it.showingProgress, it.visitedQuiz, it.shown) },
                restore = {
                    WaitQuizState(
                        warmUpId,
                        warmUps,
                        it[0] as Int,
                        (it[1] as String).ifEmpty { null },
                        it[2] as Boolean,
                        it[3] as Boolean,
                        it[4] as Boolean,
                    )
                },
            )
        }
    val quiz =
        rememberSaveable(warmUpId, saver = saver) {
            WaitQuizState(warmUpId, warmUps, warmUpId?.let { warmUps?.next(it) } ?: 0, showingProgress = loaded == null)
        }
    SideEffect { quiz.deck = loaded }
    return quiz
}

@Composable
fun WaitContent(
    quiz: WaitQuizState,
    hold: ReadyHold,
    surface: AnalyticsEvent.WarmUpSurface,
    kind: GenerationKind,
    run: GenerationRun,
    title: String,
    modifier: Modifier = Modifier,
    goalId: String? = null,
    lessonLine: String? = null,
    lessonReady: Boolean = false,
    progressBeside: Boolean = false,
    onRetry: (() -> Unit)? = null,
    progress: @Composable () -> Unit,
) {
    val stripFocus = remember { FocusRequester() }
    val progressFocus = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    var previousView by remember { mutableStateOf(quiz.showingProgress) }
    LaunchedEffect(quiz.showingProgress) {
        if (previousView != quiz.showingProgress) moveFocus(if (quiz.showingProgress) progressFocus else stripFocus)
        previousView = quiz.showingProgress
    }
    val showingProgress = quiz.showingProgress && quiz.hasQuiz && !progressBeside
    BackHandler(enabled = showingProgress) { quiz.back() }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        if (!progressBeside && quiz.hasQuiz && !quiz.showingProgress) {
            val failure = run.failure
            if (failure != null) {
                GenerationFailureNotice(failure, onRetry)
            } else {
                WaitStrip(
                    title,
                    kind.progress(run).share.coerceAtLeast(0.08f),
                    run.status == GenerationRun.Status.Ready,
                    lessonLine,
                    lessonReady,
                    Modifier.focusMoveTarget(stripFocus),
                ) {
                    quiz.showProgress(hold)
                }
            }
            HorizontalDivider()
        }
        AnimatedContent(
            targetState = !progressBeside && (quiz.showingProgress || !quiz.hasQuiz),
            transitionSpec = {
                fadeIn(tween(150, easing = ZoonkMotion.EaseOut)) togetherWith
                    fadeOut(tween(150, easing = ZoonkMotion.EaseOut)) using
                    null
            },
            label = "wait view",
        ) { progressShown ->
            if (progressShown) {
                Column(Modifier.focusMoveTarget(progressFocus).focusable().semantics { contentDescription = title }) { progress() }
            } else {
                QuizCard(quiz, surface, hold, goalId)
            }
        }
    }
}

@Composable
private fun WaitStrip(
    title: String,
    share: Float,
    ready: Boolean,
    lessonLine: String?,
    lessonReady: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val percent = formatPercent(if (ready) 1.0 else share.toDouble(), currentLocale())
    Column(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                stateDescription = percent
            }.padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Crossfade(ready, animationSpec = tween(200), label = "wait ready") { done ->
                if (done) {
                    Icon(painterResource(R.drawable.ic_check), null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.tertiary)
                } else {
                    CircularProgressIndicator(
                        progress = { share },
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.tertiary,
                        trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                    )
                }
            }
            Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            Icon(painterResource(R.drawable.ic_chevron_right), null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        lessonLine?.let {
            Row(
                Modifier.padding(start = 26.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (lessonReady) {
                    Icon(
                        painterResource(R.drawable.ic_check),
                        null,
                        Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.tertiary,
                    )
                }
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
fun WaitQuizAction(
    quiz: WaitQuizState,
    hold: ReadyHold,
    progressBeside: Boolean = false,
) {
    val label =
        when {
            !quiz.hasQuiz -> return
            quiz.showingProgress && !progressBeside -> if (quiz.visitedQuiz) R.string.warm_up_back_to_quiz else R.string.warm_up_play_quiz
            quiz.hasNext -> R.string.warm_up_next
            else -> return
        }
    OutlinedButton(onClick = {
        if (quiz.showingProgress && !progressBeside) quiz.showQuiz(hold) else quiz.next()
    }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(label)) }
}

@Composable
private fun QuizCard(
    quiz: WaitQuizState,
    surface: AnalyticsEvent.WarmUpSurface,
    hold: ReadyHold,
    goalId: String? = null,
) {
    val card = quiz.card ?: return
    val tracker = LocalEventTracker.current
    LifecycleResumeEffect(quiz.warmUpId) {
        if (!quiz.shown) {
            quiz.shown = true
            tracker.track(AnalyticsEvent.WarmUpShown(surface, quiz.deck?.cards?.size ?: 0, quiz.warmUpId, goalId))
        }
        onPauseOrDispose {}
    }
    val reveal = remember { BringIntoViewRequester() }
    val firstAnswer = remember { FocusRequester() }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Title()
        Guess(card, quiz.picked, reveal, firstAnswer) { option ->
            quiz.pick(option, hold)
            tracker.track(AnalyticsEvent.WarmUpAnswered(surface, card.id, quiz.index + 1, option.correct))
        }
    }
}

@Composable
private fun Title() {
    Row(
        Modifier.semantics(mergeDescendants = true) { heading() },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painterResource(R.drawable.ic_auto_awesome),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            stringResource(R.string.warm_up_title),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

/** The answers lock at the first tap, which shows the right one and why; a guess is never wrong, only shown its answer. */
@Composable
private fun Guess(
    card: WarmUpDeckCardsInner,
    picked: String?,
    reveal: BringIntoViewRequester,
    firstAnswer: FocusRequester,
    onPick: (WarmUpDeckCardsInnerOptionsInner) -> Unit,
) {
    Text(card.question, style = MaterialTheme.typography.titleMedium)
    AnswerOptionGroup(Modifier.semantics { contentDescription = card.question }) {
        card.options.forEachIndexed { index, option ->
            val chosen = picked == option.id
            AnswerOption(
                marker = index + 1,
                picked = chosen,
                result =
                    when {
                        picked == null -> null
                        option.correct -> AnswerResult.Right
                        chosen -> AnswerResult.Guess
                        else -> null
                    },
                onClick = { onPick(option) },
                modifier = if (index == 0) Modifier.focusRequester(firstAnswer) else Modifier,
                enabled = picked == null,
                guessed = true,
            ) { Text(option.text, style = MaterialTheme.typography.bodyLarge) }
        }
    }

    if (picked == null) {
        Text(
            stringResource(R.string.warm_up_guess_hint),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }

    val right = card.options.any { it.id == picked && it.correct }
    Column(
        Modifier.bringIntoViewRequester(reveal).semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FeedbackVerdict(
            text = stringResource(if (right) R.string.player_verdict_guess_right else R.string.player_verdict_guess),
            tone = if (right) FeedbackTone.Right else FeedbackTone.Neutral,
            icon = if (right) null else R.drawable.ic_auto_awesome,
        )
        Text(card.reveal, style = MaterialTheme.typography.bodyLarge)
    }
}
