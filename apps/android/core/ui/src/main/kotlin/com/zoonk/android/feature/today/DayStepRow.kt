package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.optionalStudyLabel
import com.zoonk.android.feature.session.BlockMark
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StepOpenFailed
import com.zoonk.android.feature.session.WritingRow
import com.zoonk.android.feature.session.blockDetail
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.practisesTopics
import com.zoonk.android.feature.session.remedialLine
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.ExamDocument
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
    examDocument: ExamDocument,
    modifier: Modifier = Modifier,
    lessonStatus: Map<String, LessonGenerationStatus> = emptyMap(),
    writingStalled: Boolean = false,
    onOpen: (() -> Unit)? = null,
    busy: Boolean = false,
    openFailed: Boolean = false,
    below: (@Composable () -> Unit)? = null,
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
        supporting = {
            if (openFailed) StepOpenFailed()
            StepLines(lessonStatus, writingStalled, day, step, examDocument)
            if (!finished) below?.invoke()
        },
        meta =
            if (finished && !step.extra) {
                null
            } else {
                {
                    if (step.extra) Eyebrow(stringResource(R.string.today_step_extra))
                    if (!finished) {
                        if (mission) {
                            Icon(
                                painter = painterResource(R.drawable.ic_checklist),
                                contentDescription = stringResource(R.string.today_step_counts_toward_mission),
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.zoonk.brain,
                            )
                        }
                        DayMinutes(step.estimatedMinutes)
                    }
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

/** Main's `showSubject`: a row names its subject only on a day that mixes subjects. */
private val DayView.mixesSubjects: Boolean
    get() = steps.mapNotNull { it.subject ?: it.subjectExtra?.value }.distinct().size > 1

/**
 * Main's `RowLines`: the subject first, on a day that mixes subjects or for optional study, even
 * once done; then, while it's to do, what practice is on, why it's back or how long a challenge is.
 */
@Composable
private fun StepLines(
    lessonStatus: Map<String, LessonGenerationStatus>,
    writingStalled: Boolean,
    day: DayView,
    step: DayStep,
    examDocument: ExamDocument,
) {
    val extra = step.subjectExtra
    val subject =
        when {
            extra != null -> optionalStudyLabel(hasNotice = extra == StudyBlock.SubjectExtra.NOTICE, document = examDocument)
            day.mixesSubjects -> step.subject
            else -> null
        }

    subject?.let { SubLine(it) }
    if (!step.isFinished) stepLine(lessonStatus, writingStalled, step)?.let { SubLine(it) }
}

/** Main's `useStepLabel` without the subject, which [StepLines] puts above it. */
@Composable
private fun stepLine(
    lessonStatus: Map<String, LessonGenerationStatus>,
    writingStalled: Boolean,
    step: DayStep,
): String? {
    val count = step.questions.toInt()
    val remedial = remedialLine(step)
    val moreTopics = step.topics.size - 1

    return when {
        step.isGettingReady(lessonStatus, writingStalled) -> stringResource(R.string.today_step_being_written)

        step.writing == WritingRow.Tomorrow -> blockDetail(step)

        step.waitReason != null -> stringResource(R.string.today_step_after_lessons)

        remedial != null -> remedial

        // The title names a practice's first topic, so the line counts the others.
        step.practisesTopics && moreTopics > 0 -> pluralStringResource(R.plurals.today_step_more_topics, moreTopics, moreTopics)

        step.checkpoint != null -> if (count > 0) pluralStringResource(R.plurals.session_block_questions, count, count) else null

        step.fullReview -> stringResource(R.string.today_step_every_topic)

        // A written task says that its draft is kept, or what a drill is for.
        step.kind == StudyBlock.Kind.PRODUCE && (step.writing != null || step.drill) -> blockDetail(step)

        else -> null
    }
}

@Composable
private fun SubLine(text: String) {
    Text(text = text, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

/**
 * A row of the day on main's `ListRow`: the next block on `muted`, the others over a hairline,
 * except right above the next block.
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

fun DayStep.isGettingReady(
    lessonStatus: Map<String, LessonGenerationStatus>,
    writingStalled: Boolean,
): Boolean = preparing || (!writingStalled && isBeingWritten(lessonStatus))
