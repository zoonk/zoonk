package com.zoonk.android.feature.practice.block

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.feature.questions.ItemSet
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
        Text(
            text = stringResource(R.string.practice_net_tally, right, wrong, net),
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
    Note(R.drawable.ic_history, timeMachineText(machine, format, words, right = null))
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
        Note(R.drawable.ic_local_cafe, stringResource(R.string.practice_pause_text))
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

/** How the block went, until the session's day moment takes this place. */
@Composable
internal fun BlockDone(
    completion: StudyBlockCompletion,
    modifier: Modifier = Modifier,
) {
    Column(modifier.padding(horizontal = 16.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(
            text = stringResource(R.string.practice_done_title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
        )
        MomentReadouts(completion.brainPower, score = MomentScore(completion.total.toInt(), completion.correct.toInt()))
    }
}

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
    onCheck: () -> Unit,
) {
    Button(onClick = onCheck, enabled = enabled && !busy, modifier = Modifier.fillMaxWidth()) {
        if (busy) CircularProgressIndicator(Modifier.padding(end = 8.dp).size(16.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
        Text(stringResource(R.string.practice_check))
    }
}

@Composable
internal fun SaveError(onRetry: () -> Unit) {
    ActionColumn {
        SaveErrorText()
        Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.practice_try_again)) }
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

/** The main action fills the row; another (not sure, ask the buddy) sits at its start. */
@Composable
internal fun ActionRow(
    ask: @Composable () -> Unit,
    content: @Composable RowScope.() -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        ask()
        Row(
            Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

@Composable
private fun Note(
    @DrawableRes icon: Int,
    text: String,
) {
    val style = MaterialTheme.typography.bodyMedium
    val size = with(LocalDensity.current) { style.lineHeight.toDp() }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(size).padding(2.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style, fontWeight = FontWeight.Normal)
    }
}
