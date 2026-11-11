package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.learnKind
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.StudyBlock

/**
 * Main's `DayProgress`: the day's blocks by their minutes, the ones ahead in their kind's color.
 * Tapping a block opens what it is and where the learner stands in it.
 */
@Composable
internal fun DayProgress(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val day = model.day
    val done = day.steps.count(DayStep::isFinished)
    val tertiary = MaterialTheme.colorScheme.tertiary
    val skipped = MaterialTheme.colorScheme.onSurface.copy(alpha = SKIPPED_ALPHA)
    val held = day.heldMinutes
    val parts =
        day.steps.map { step ->
            val fill =
                when (step.state(day.nextPosition)) {
                    SegmentState.Done -> {
                        MeterPart.Fill.Solid(tertiary)
                    }

                    SegmentState.Skipped -> {
                        MeterPart.Fill.Solid(skipped)
                    }

                    SegmentState.Current -> {
                        MeterPart.Fill.Place(step.share)
                    }

                    SegmentState.Ahead -> {
                        if (step.learnKind == LearnKind.Lesson) {
                            MeterPart.Fill.Track
                        } else {
                            MeterPart.Fill.Solid(step.learnKind.color.copy(alpha = AHEAD_ALPHA))
                        }
                    }
                }
            MeterPart(fill, weight = step.estimatedMinutes.coerceAtLeast(1).toFloat())
        } + listOfNotNull(held.takeIf { it > 0 }?.let { MeterPart(MeterPart.Fill.Track, weight = it.toFloat()) })

    MeterParts(parts, modifier, contentDescription = stepsDone(done, day.steps.size)) { index ->
        val step = day.steps.getOrNull(index)
        if (step != null) StepSegment(step, step.state(day.nextPosition)) else HeldSegment(model, held)
    }
}

private enum class SegmentState { Done, Skipped, Current, Ahead }

private fun DayStep.state(nextPosition: Long?): SegmentState =
    when {
        status == StudyBlock.Status.COMPLETED -> SegmentState.Done
        status == StudyBlock.Status.SKIPPED -> SegmentState.Skipped
        position == nextPosition -> SegmentState.Current
        else -> SegmentState.Ahead
    }

private val DayStep.share: Float
    get() = if (status != StudyBlock.Status.ACTIVE || questions == 0L) 0f else (answered.toFloat() / questions).coerceAtMost(1f)

@Composable
private fun StepSegment(
    step: DayStep,
    state: SegmentState,
) {
    val title = blockTitle(step)
    val facts = segmentFacts(step, state)

    Segment(title = title, facts = facts, note = kindNote(step.learnKind), kind = step.learnKind)
}

/** The day's time kept for lessons that aren't on its list yet. */
@Composable
private fun HeldSegment(
    model: TodayDayModel,
    minutes: Double,
) {
    val note =
        when {
            model.day.lessonsToPrepare -> R.string.today_coming_not_written
            model.writingStalled -> R.string.today_coming_stalled
            else -> R.string.today_coming_writing
        }

    Segment(
        title = stringResource(R.string.today_coming_title),
        facts = formatMinutes(minutes, currentLocale()),
        note = stringResource(note),
        kind = LearnKind.Lesson,
    )
}

/** As tall as a finger needs, though the bar it sits on is thin. */
@Composable
private fun Segment(
    title: String,
    facts: String,
    note: String?,
    kind: LearnKind,
) {
    val label = stringResource(R.string.today_segment_label, title, facts)

    TodayPopover(title = title, facts = facts, note = note, kind = kind) { open ->
        Box(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(MaterialTheme.shapes.small)
                .then(open)
                .semantics { contentDescription = label },
        )
    }
}

@Composable
private fun segmentFacts(
    step: DayStep,
    state: SegmentState,
): String {
    val locale = currentLocale()
    val time = formatMinutes(step.estimatedMinutes.toInt(), locale)

    return when (state) {
        SegmentState.Done -> {
            stringResource(R.string.today_step_done)
        }

        SegmentState.Skipped -> {
            stringResource(R.string.today_step_skipped)
        }

        SegmentState.Ahead -> {
            time
        }

        SegmentState.Current -> {
            if (step.status == StudyBlock.Status.ACTIVE && step.answered > 0) {
                val questions = step.questions.toInt()
                pluralStringResource(
                    R.plurals.today_segment_questions,
                    questions,
                    formatNumber(step.answered.toDouble(), locale),
                    questions,
                )
            } else {
                listOf(stringResource(R.string.today_segment_up_next), time).factsLine()
            }
        }
    }
}

/** What a kind is for; a lesson says it itself. */
@Composable
private fun kindNote(kind: LearnKind): String? {
    val note =
        when (kind) {
            LearnKind.Review -> R.string.today_segment_review_note
            LearnKind.Practice -> R.string.today_segment_practice_note
            LearnKind.Mistakes -> R.string.today_segment_mistakes_note
            LearnKind.Challenge -> R.string.today_segment_challenge_note
            LearnKind.Mock -> R.string.today_segment_mock_note
            LearnKind.Essay -> R.string.today_segment_essay_note
            LearnKind.Lesson, LearnKind.Conversation, LearnKind.MindMap -> null
        }

    return note?.let { stringResource(it) }
}

private const val SKIPPED_ALPHA = 0.25f
private const val AHEAD_ALPHA = 0.5f
