package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.BlockMark
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StepOpenFailed
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.practisesTopics
import com.zoonk.android.feature.session.shortTopicList
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.StudyBlock

fun DayView.countsTowardMission(step: DayStep): Boolean =
    !fullMeal.earned && missions.any { mission -> !mission.done && mission.waitReason == null && mission.opens.opensStep(step) }

private fun MissionOpens?.opensStep(step: DayStep): Boolean =
    when {
        this !is MissionOpens.Block -> false
        blockId != null -> blockId == step.id
        else -> position == step.position
    }

/** A finished row shows no minutes: they were the plan's estimate, not the time it took. */
@Composable
fun DayStepRow(
    day: DayView,
    step: DayStep,
    isNext: Boolean,
    modifier: Modifier = Modifier,
    lessonStatus: Map<String, LessonGenerationStatus> = emptyMap(),
    writingStalled: Boolean = false,
    onOpen: (() -> Unit)? = null,
    busy: Boolean = false,
    openFailed: Boolean = false,
    testOut: (@Composable () -> Unit)? = null,
    tag: (@Composable () -> Unit)? = null,
    divider: Boolean = true,
) {
    val finished = step.isFinished
    val mission = day.countsTowardMission(step)
    val state =
        when (step.status) {
            StudyBlock.Status.COMPLETED -> stringResource(R.string.today_step_done)
            StudyBlock.Status.SKIPPED -> stringResource(R.string.today_step_skipped)
            else -> if (isNext) stringResource(R.string.today_step_next) else null
        }

    DayQueueRow(
        isNext = isNext,
        busy = busy,
        onClick = onOpen,
        modifier = modifier,
        divider = divider,
        stateDescription = state,
        leading = { BlockMark(step) },
        supporting =
            if (finished && !openFailed) {
                null
            } else {
                {
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        if (openFailed) StepOpenFailed()
                        if (!finished) {
                            tag?.invoke()
                            StepLines(lessonStatus, writingStalled, step)
                            testOut?.invoke()
                        }
                    }
                }
            },
        meta =
            if (finished) {
                null
            } else {
                {
                    if (mission) {
                        Icon(
                            painter = painterResource(R.drawable.ic_target),
                            contentDescription = stringResource(R.string.today_step_counts_toward_mission),
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.zoonk.brain,
                        )
                    }
                    DayMinutes(step.estimatedMinutes)
                }
            },
    ) {
        Text(
            text = blockTitle(step),
            // Two lines, so a large font still shows what the step is.
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            color = if (finished) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** A row's one line: what a lesson belongs to, what practice is on, or how long a challenge is. */
@Composable
private fun StepLines(
    lessonStatus: Map<String, LessonGenerationStatus>,
    writingStalled: Boolean,
    step: DayStep,
) {
    val count = step.questions.toInt()
    val line =
        when {
            !writingStalled && step.isBeingWritten(lessonStatus) -> stringResource(R.string.today_step_being_written)
            step.waitReason != null -> stringResource(R.string.today_step_after_lessons)
            step.practisesTopics -> shortTopicList(step.topics, named = 1)
            step.checkpoint != null -> if (count > 0) pluralStringResource(R.plurals.session_block_questions, count, count) else null
            step.fullReview -> stringResource(R.string.today_step_every_topic)
            else -> step.subject
        }

    if (line != null) SubLine(line)
}

@Composable
private fun SubLine(text: String) {
    Text(text = text, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

/**
 * A row of the day on main's `ListRow`: the next block on `muted`, its mark on the title's first line
 * (main's `items-start`), the others over a hairline, except right above the next block.
 */
@Composable
fun DayQueueRow(
    onClick: (() -> Unit)?,
    modifier: Modifier,
    leading: @Composable () -> Unit,
    isNext: Boolean = false,
    busy: Boolean = false,
    waiting: Boolean = false,
    divider: Boolean = true,
    stateDescription: String? = null,
    supporting: (@Composable () -> Unit)? = null,
    meta: (@Composable () -> Unit)? = null,
    headline: @Composable () -> Unit,
) {
    Column(modifier) {
        ListRow(
            headline = headline,
            onClick = onClick,
            enabled = !waiting,
            focusableWhenDisabled = waiting,
            busy = busy,
            highlighted = isNext,
            stateDescription = stateDescription,
            leading = leading,
            supporting = supporting,
            meta = meta,
            verticalAlignment = if (isNext) Alignment.Top else Alignment.CenterVertically,
            chevron = false,
        )
        if (!isNext && divider) HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
    }
}

@Composable
fun DayMinutes(minutes: Long) {
    DayMinutes(minutes.toDouble())
}

@Composable
fun DayMinutes(minutes: Double) {
    Text(
        text = formatMinutes(minutes, currentLocale()),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.zoonkType.data,
    )
}

/**
 * A lesson nobody has started writing is written when the learner opens it, so it never claims to
 * be in progress.
 */
fun DayStep.isBeingWritten(lessonStatus: Map<String, LessonGenerationStatus>): Boolean =
    kind == StudyBlock.Kind.LEARN && lessonId != null && lessonStatus[lessonId.toString()] == LessonGenerationStatus.GENERATING
