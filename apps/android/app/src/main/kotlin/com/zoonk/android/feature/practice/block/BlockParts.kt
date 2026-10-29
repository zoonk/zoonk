package com.zoonk.android.feature.practice.block

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.NoteRow
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.SetPlace
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.plainItemLine
import com.zoonk.android.feature.questions.trueFalseLabel
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.StudyBlockCompletion
import java.time.Instant
import java.time.ZoneId
import com.zoonk.android.feature.questions.TimeMachine as TimeMachineFacts

/** Where a wrong answer cancels a right one: this visit's count and what leaving blank is for. */
@Composable
internal fun SwipeScore(tally: NetTally) {
    val right = pluralStringResource(R.plurals.practice_net_right, tally.right, tally.right)
    val wrong = pluralStringResource(R.plurals.practice_net_wrong, tally.wrong, tally.wrong)
    val net = stringResource(R.string.practice_net, tally.right - tally.wrong)

    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val tally = stringResource(R.string.practice_net_tally, right, wrong, net)
        val emphasis = SpanStyle(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
        Text(
            text =
                buildAnnotatedString {
                    append(tally)
                    tally.lastIndexOf(net).takeIf { it >= 0 }?.let { addStyle(emphasis, it, it + net.length) }
                },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
        )
        Text(
            text = stringResource(R.string.practice_net_hint),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Before the answer, only that the learner saw it: an earlier answer could give today's away. */
@Composable
internal fun TimeMachine(
    machine: TimeMachineFacts,
    format: QuestionFormat,
    words: TrueFalseWords,
) {
    NoteRow(R.drawable.ic_history) { NoteText(timeMachineText(machine, format, words, right = null)) }
}

@Composable
internal fun TimeMachineNote(
    machine: TimeMachineFacts,
    format: QuestionFormat,
    words: TrueFalseWords,
    right: Boolean,
) {
    FeedbackNote(timeMachineText(machine, format, words, right))
}

@Composable
private fun timeMachineText(
    machine: TimeMachineFacts,
    format: QuestionFormat,
    words: TrueFalseWords,
    right: Boolean?,
): String {
    val date =
        formatDate(Instant.parse(machine.answeredAt).atZone(ZoneId.systemDefault()).toLocalDate(), currentLocale(), DateStyle.DayMonth)
    val answer =
        when {
            format == QuestionFormat.TrueFalse && machine.answer == "true" -> trueFalseLabel(true, words)
            format == QuestionFormat.TrueFalse && machine.answer == "false" -> trueFalseLabel(false, words)
            else -> machine.answer?.let(::plainItemLine)?.trimEnd('.')
        }

    return when {
        right == null -> stringResource(R.string.practice_time_machine_seen, date)
        machine.isCorrect && right -> stringResource(R.string.practice_time_machine_right_again, date)
        machine.isCorrect -> stringResource(R.string.practice_time_machine_right_before, date)
        !answer.isNullOrEmpty() -> stringResource(R.string.practice_time_machine_answered, date, answer)
        else -> stringResource(R.string.practice_time_machine_tripped, date)
    }
}

@Composable
internal fun PauseSuggestion(viewModel: QuestionBlockViewModel) {
    val stop by viewModel.stop.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        NoteRow(R.drawable.ic_local_cafe) { NoteText(stringResource(R.string.practice_pause_text)) }
        FilledTonalButton(onClick = viewModel::stopSession, enabled = stop != QuestionBlockViewModel.StopState.Stopping) {
            Text(stringResource(R.string.practice_pause_stop))
        }
        if (stop == QuestionBlockViewModel.StopState.Failed) {
            Text(
                text = stringResource(R.string.practice_pause_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** A fully answered block waits for Finish: finishing can prepare the rest of the day. */
@Composable
internal fun FinishReady() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = stringResource(R.string.practice_finish_ready_title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = stringResource(R.string.practice_finish_ready_detail),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

/**
 * How the block went, until the session's day moment takes this place: the title first, saving
 * while [completion] is on its way, so nothing moves when the score arrives.
 */
@Composable
internal fun BlockDone(
    completion: StudyBlockCompletion?,
    review: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = DONE_WIDTH).fillMaxWidth().padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Text(
                text = stringResource(if (review) R.string.practice_done_review else R.string.practice_done_title),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            if (completion == null) {
                Text(
                    text = stringResource(R.string.player_saving_progress),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            } else {
                MomentReadouts(completion.brainPower, score = MomentScore(completion.total.toInt(), completion.correct.toInt()))
            }
        }
    }
}

private val DONE_WIDTH = 640.dp

/** A recording set's place and task; its player comes with the listening milestone. */
@Composable
internal fun ListeningSet(set: ItemSet) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SetPlace(set)
        set.listening?.title?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
        set.listening?.task?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
internal fun CheckButton(
    busy: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onCheck: () -> Unit,
) {
    Button(onClick = onCheck, enabled = enabled && !busy, modifier = modifier) {
        if (busy) CircularProgressIndicator(Modifier.padding(end = 8.dp).size(16.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
        Text(stringResource(R.string.practice_check))
    }
}

@Composable
internal fun SaveErrorText() {
    Text(
        text = stringResource(R.string.practice_save_error),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
internal fun ActionColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
}

/**
 * The task's actions, the main one at the end on a wide window (as the player's). On a narrow one
 * the main action fills its line and moves to a line of its own when the others don't leave it
 * room, so a large font never breaks its word.
 */
@Composable
internal fun ActionFlow(content: @Composable FlowRowScope.(main: Modifier) -> Unit) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, if (wide) Alignment.End else Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) { content(if (wide) Modifier.widthIn(min = MAIN_ACTION_WIDTH) else Modifier.weight(1f)) }
}

private val MAIN_ACTION_WIDTH = 160.dp

/** The task's actions stay as wide as its questions on a wide window. */
@Composable
internal fun ActionBarWidth(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(Modifier.widthIn(max = ACTIONS_WIDTH).fillMaxWidth()) { content() }
    }
}

private val ACTIONS_WIDTH = 640.dp

@Composable
private fun NoteText(text: String) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}
