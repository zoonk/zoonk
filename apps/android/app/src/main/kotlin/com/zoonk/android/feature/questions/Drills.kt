package com.zoonk.android.feature.questions

import android.os.SystemClock
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlinx.coroutines.delay
import kotlin.math.ceil

/** What a drill asks of the learner, in one line. */
@Composable
fun drillLine(drill: Drill): String =
    when (drill.kind) {
        Drill.Kind.Reteach -> {
            stringResource(
                if (drill.isIdeaFirst) R.string.questions_drill_reteach_ideas else R.string.questions_drill_reteach,
            )
        }

        Drill.Kind.ReadCarefully -> {
            stringResource(R.string.questions_drill_read_carefully)
        }

        Drill.Kind.SpotTheTrap -> {
            stringResource(R.string.questions_drill_spot_the_trap)
        }

        Drill.Kind.Timed -> {
            (drill.timeLimitSeconds ?: 0).let { pluralStringResource(R.plurals.questions_drill_timed, it, it) }
        }

        Drill.Kind.NoGuessing -> {
            stringResource(R.string.questions_drill_no_guessing)
        }

        Drill.Kind.Retry -> {
            stringResource(R.string.questions_drill_retry)
        }
    }

/**
 * A content gap's lesson ideas, on a screen of their own before its questions (main's idea screen);
 * the host puts [DrillStartButton] in its action bar.
 */
@Composable
fun DrillIdeas(
    drill: Drill,
    onOpenLesson: ((lessonId: String) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val lesson = drill.lesson ?: return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(text = lesson.title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            Text(text = drillLine(drill), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }

        Column {
            lesson.ideas.forEachIndexed { index, idea ->
                if (index > 0) HorizontalDivider()
                Row(Modifier.padding(vertical = 11.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = (index + 1).toString(),
                        modifier = Modifier.widthIn(min = 16.dp).clearAndSetSemantics {},
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                    )
                    Text(text = idea, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }

        if (onOpenLesson != null) LessonLink(lesson, onOpenLesson)
    }
}

@Composable
fun DrillStartButton(
    onStart: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(onClick = onStart, modifier = modifier.fillMaxWidth()) { Text(stringResource(R.string.questions_drill_start)) }
}

/**
 * A drill's line over its question (main's `DrillNote`): what it asks until it's answered, what
 * the learner answered last time, and the lesson behind a content gap.
 */
@Composable
fun DrillNote(
    drill: Drill,
    onOpenLesson: ((lessonId: String) -> Unit)?,
    modifier: Modifier = Modifier,
    answered: Boolean = false,
    lastAnswer: String? = null,
) {
    val lesson = drill.lesson.takeIf { drill.kind == Drill.Kind.Reteach && onOpenLesson != null }
    if (drill.kind == Drill.Kind.Retry && lastAnswer == null) return
    if (answered && lastAnswer == null && lesson == null) return

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NoteIcon(drill.kind.icon)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (!answered) {
                Text(
                    text = drillLine(drill),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
            lastAnswer?.let {
                Text(
                    text = stringResource(R.string.questions_drill_last_answer, it),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (lesson != null && onOpenLesson != null) LessonLink(lesson, onOpenLesson)
        }
    }
}

/** What a drill says once answered: time ran out, a good "not sure", the trap it hid. */
@Composable
fun DrillAnswerNotes(
    drill: Drill?,
    notSure: Boolean,
    timedOut: Boolean,
    trap: String?,
) {
    if (timedOut) {
        NoteRow(R.drawable.ic_timer_off) {
            Text(stringResource(R.string.questions_drill_timed_out), style = MaterialTheme.typography.bodyMedium)
        }
    }

    if (notSure && drill?.kind == Drill.Kind.NoGuessing) {
        NoteRow(R.drawable.ic_back_hand) {
            Text(stringResource(R.string.questions_drill_not_sure_praise), style = MaterialTheme.typography.bodyMedium)
        }
    }

    if (trap != null) {
        val label = stringResource(R.string.questions_drill_trap)
        NoteRow(R.drawable.ic_warning) {
            Text(
                text =
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(label) }
                        append(" ")
                        append(trap)
                    },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/**
 * A timed drill's clock, the whole time for each question. It counts from when this question first
 * showed, kept across rotation and recreation, so turning the phone never gives time back; key it
 * by the question.
 */
@Composable
fun DrillCountdown(
    seconds: Int,
    onTimeUp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val total = seconds * MILLIS_PER_SECOND
    val startedAt = rememberSaveable { SystemClock.elapsedRealtime() }
    var remaining by remember { mutableLongStateOf(total - (SystemClock.elapsedRealtime() - startedAt)) }
    val timeUp by rememberUpdatedState(onTimeUp)

    LaunchedEffect(startedAt) {
        while (true) {
            remaining = (total - (SystemClock.elapsedRealtime() - startedAt)).coerceAtLeast(0)
            if (remaining == 0L) break
            delay(TICK_MILLIS)
        }
        timeUp()
    }

    val secondsLeft = ceil(remaining / MILLIS_PER_SECOND.toDouble()).toInt()
    val warning = secondsLeft <= WARNING_SECONDS
    val warningColor = MaterialTheme.zoonk.warning
    val announcement = countdownAnnouncement(secondsLeft)
    val clockStyle = MaterialTheme.typography.labelLarge.withTabularFigures()

    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(
            painter = painterResource(R.drawable.ic_timer),
            contentDescription = null,
            modifier = Modifier.size(clockStyle.lineHeightDp()),
            tint = if (warning) warningColor else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Meter(
            share = remaining.toFloat() / total,
            modifier = Modifier.weight(1f),
            // Ink, as main's: a draining clock isn't progress, which is blue.
            color = if (warning) warningColor else MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = formatClock(remaining),
            modifier =
                Modifier.semantics {
                    contentDescription = announcement
                    liveRegion = LiveRegionMode.Polite
                },
            color = if (warning) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurface,
            style = clockStyle,
        )
    }
}

/** Only a few marks are read aloud: every second would talk over the question. */
@Composable
private fun countdownAnnouncement(secondsLeft: Int): String {
    var announced by rememberSaveable { mutableStateOf<Int?>(null) }
    val next = announcedSeconds(announced, secondsLeft)
    if (next != announced) announced = next

    return when {
        secondsLeft == 0 -> stringResource(R.string.questions_drill_time_up)
        next == null -> stringResource(R.string.questions_drill_time_left)
        else -> pluralStringResource(R.plurals.questions_drill_seconds_left, next, next)
    }
}

internal fun announcedSeconds(
    announced: Int?,
    secondsLeft: Int,
): Int? =
    when {
        secondsLeft > WARNING_SECONDS -> null
        announced == null || secondsLeft in ANNOUNCED_SECONDS -> secondsLeft
        else -> announced
    }

/** "0:45", as main's `formatClock` writes it. */
internal fun formatClock(millis: Long): String {
    val totalSeconds = ceil(millis / MILLIS_PER_SECOND.toDouble()).toLong()
    val hours = totalSeconds / SECONDS_PER_HOUR
    val minutes = totalSeconds / SECONDS_PER_MINUTE % MINUTES_PER_HOUR
    val seconds = totalSeconds % SECONDS_PER_MINUTE
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}

/** "I've read it. Show the answers", a read-carefully drill's main action before its options show. */
@Composable
fun ShowAnswersButton(
    onReveal: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(onClick = onReveal, modifier = modifier.fillMaxWidth()) {
        Icon(painterResource(R.drawable.ic_visibility), contentDescription = null, modifier = Modifier.padding(end = 8.dp).size(18.dp))
        Text(stringResource(R.string.questions_drill_show_answers))
    }
}

/** "I'm not sure" in a no-guessing drill, or [label] where another word fits ("I don't know yet"). */
@Composable
fun NotSureButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    label: String = stringResource(R.string.questions_drill_not_sure),
) {
    FilledTonalButton(onClick = onClick, modifier = modifier, enabled = enabled) {
        Icon(painterResource(R.drawable.ic_help), contentDescription = null, modifier = Modifier.padding(end = 8.dp).size(18.dp))
        Text(label)
    }
}

@Composable
private fun LessonLink(
    lesson: Drill.Lesson,
    onOpenLesson: (lessonId: String) -> Unit,
) {
    FilledTonalButton(onClick = { onOpenLesson(lesson.id) }) {
        Text(stringResource(R.string.questions_drill_open_lesson))
        Icon(painterResource(R.drawable.ic_open_in_new), contentDescription = null, modifier = Modifier.padding(start = 8.dp).size(18.dp))
    }
}

/** A quiet line with its symbol beside it, as main's `Callout`. */
@Composable
internal fun NoteRow(
    @DrawableRes icon: Int,
    text: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NoteIcon(icon)
        text()
    }
}

@Composable
private fun NoteIcon(
    @DrawableRes icon: Int,
) {
    val size = MaterialTheme.typography.bodyMedium.lineHeightDp()
    Icon(
        painterResource(icon),
        contentDescription = null,
        modifier = Modifier.size(size).padding(2.dp),
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@get:DrawableRes
private val Drill.Kind.icon: Int
    get() =
        when (this) {
            Drill.Kind.NoGuessing -> R.drawable.ic_back_hand
            Drill.Kind.ReadCarefully -> R.drawable.ic_visibility
            Drill.Kind.Reteach -> R.drawable.ic_lightbulb
            Drill.Kind.Retry -> R.drawable.ic_replay
            Drill.Kind.SpotTheTrap -> R.drawable.ic_warning
            Drill.Kind.Timed -> R.drawable.ic_timer
        }

private val ANNOUNCED_SECONDS = setOf(10, 5)
private const val WARNING_SECONDS = 10
private const val TICK_MILLIS = 250L
private const val MILLIS_PER_SECOND = 1_000L
private const val SECONDS_PER_MINUTE = 60L
private const val MINUTES_PER_HOUR = 60L
private const val SECONDS_PER_HOUR = 3_600L
