package com.zoonk.android.feature.practice

import androidx.annotation.DrawableRes
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.LessonTitle
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.NoteRow
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.SetPlace
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.plainItemLine
import com.zoonk.android.feature.questions.savedAnswerText
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.ResultPages
import com.zoonk.android.ui.scaffold.ResultScreen
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import java.time.Instant
import java.time.ZoneId
import com.zoonk.android.feature.questions.TimeMachine as TimeMachineFacts

/** Where a wrong answer cancels a right one: this visit's count and what leaving blank is for. */
@Composable
fun SwipeScore(tally: NetTally) {
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
fun TimeMachine(
    machine: TimeMachineFacts,
    format: QuestionFormat,
    words: TrueFalseWords,
) {
    NoteRow(R.drawable.ic_history) { NoteText(timeMachineText(machine, format, words, right = null)) }
}

@Composable
fun TimeMachineNote(
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
        machine.answer?.let {
            if (format == QuestionFormat.TrueFalse) savedAnswerText(it, words) else plainItemLine(it).trimEnd('.')
        }

    return when {
        right == null -> stringResource(R.string.practice_time_machine_seen, date)
        machine.isCorrect && right -> stringResource(R.string.practice_time_machine_right_again, date)
        machine.isCorrect -> stringResource(R.string.practice_time_machine_right_before, date)
        !answer.isNullOrEmpty() -> stringResource(R.string.practice_time_machine_answered, date, answer)
        else -> stringResource(R.string.practice_time_machine_tripped, date)
    }
}

/**
 * A run's result in place of its questions: the title first and saving while [saving], so nothing
 * moves when the score arrives, then [content], the numbers and the day's moment. Where the screen
 * splits ([ResultPages]) all of it takes the page before the split, and the way on the page after.
 */
@Composable
private fun RunDone(
    title: String,
    saving: Boolean,
    detail: String?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    ResultPages(
        modifier = modifier,
        withMoment = !saving,
        columnModifier = Modifier.taskColumn(),
        done = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(text = title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
                detail?.let {
                    Text(
                        text = it,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
            if (saving) {
                Text(
                    text = stringResource(R.string.player_saving_progress),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            } else {
                content()
            }
        },
        next = {},
    )
}

/**
 * A screen of a run with one decision (an intro, a wait, a note), its way on in [bottomBar]: across
 * an unfolded book's fold it keeps to the page before it, the way on under what it acts on.
 */
@Composable
fun RunPage(
    onClose: () -> Unit,
    title: @Composable () -> Unit = {},
    bottomBar: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    TaskScaffold(onClose = onClose, title = title, bottomBar = bottomBar, lonePage = true) { padding ->
        RunColumn(Modifier.padding(padding), content = content)
    }
}

@Composable
fun RunColumn(
    modifier: Modifier,
    scroll: ScrollState = rememberScrollState(),
    content: @Composable ColumnScope.() -> Unit,
) {
    BeforeFold(modifier) { beforeFold ->
        Column(
            beforeFold
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(Modifier.taskColumn(), verticalArrangement = Arrangement.spacedBy(24.dp), content = content)
        }
    }
}

@Composable
fun RunIntro(
    title: String,
    detail: String,
    facts: List<String> = emptyList(),
    titleFocus: FocusRequester? = null,
) {
    val titleModifier = titleFocus?.let { Modifier.focusRequester(it).focusable() } ?: Modifier
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = title, modifier = titleModifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            Text(text = detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }
        if (facts.isNotEmpty()) Facts(facts)
    }
}

@Composable
fun RunFinished(
    title: String,
    action: String,
    saving: Boolean,
    onClose: () -> Unit,
    detail: String? = null,
    headerTitle: String? = null,
    actions: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    ResultScreen {
        TaskScaffold(
            onClose = onClose,
            title = { headerTitle?.let { LessonTitle(it) } },
            bottomBar = {
                TaskActionBar {
                    if (actions != null) {
                        actions()
                    } else {
                        TaskActions { width -> BusyButton(action, busy = saving, enabled = true, modifier = width, onClick = onClose) }
                    }
                }
            },
        ) { padding -> RunDone(title, saving, detail, modifier = Modifier.padding(padding), content = content) }
    }
}

@Composable
fun RunLoading(onClose: () -> Unit) {
    TaskScaffold(onClose = onClose) { padding -> PageLoading(Modifier.padding(padding)) }
}

@Composable
fun RunLoadFailed(
    onClose: () -> Unit,
    onRetry: () -> Unit,
) {
    TaskScaffold(onClose = onClose) { padding -> LoadFailedMessage(onRetry = onRetry, modifier = Modifier.padding(padding)) }
}

/** A recording set's place and task; its player comes with the listening milestone. */
@Composable
fun ListeningSet(set: ItemSet) {
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

/** A pending action keeps focus while unavailable, including when its caller disables it during the write. */
@Composable
fun BusyButton(
    label: String,
    busy: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
    onClick: () -> Unit,
) {
    Button(
        onClick = { if (!busy) onClick() },
        enabled = enabled || busy,
        modifier = modifier.semantics { if (busy) disabled() },
    ) {
        if (icon != null && !busy) {
            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        }
        PendingLabel(busy, label)
    }
}

/** [onRetry] sends the same answer again: the only way to resend an "I don't know" or a time-up answer. */
@Composable
fun SaveErrorText(onRetry: (() -> Unit)? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = stringResource(R.string.practice_save_error),
            modifier = Modifier.weight(1f, fill = false).semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
        onRetry?.let { TextButton(onClick = it) { Text(stringResource(R.string.practice_try_again)) } }
    }
}

@Composable
fun NoteText(text: String) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}
