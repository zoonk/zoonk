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
import com.zoonk.android.feature.session.DayPart
import com.zoonk.android.feature.session.DayProgress
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.dayParts
import com.zoonk.android.feature.session.learnKind
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.StudyBlock

/**
 * Main's `DayProgress`: one equal part per counted block, the ones ahead in their kind's color.
 * Tapping a block opens what it is and where the learner stands in it.
 */
@Composable
internal fun TodayDayProgress(
    model: TodayDayModel,
    modifier: Modifier,
) {
    val day = model.day
    val next = day.steps.firstOrNull { it.position == day.nextPosition }
    val parts = dayParts(day.steps, isNext = { it.position == day.nextPosition }, nextShare = next?.share ?: 0f)

    DayProgress(parts, held = day.heldMinutes > 0, modifier, contentDescription = stepsDone(day.sessionBar)) { index ->
        val part = parts.getOrNull(index)
        if (part != null) StepSegment(part) else HeldSegment(model, day.heldMinutes)
    }
}

private val DayStep.share: Float
    get() = if (status != StudyBlock.Status.ACTIVE || questions == 0L) 0f else (answered.toFloat() / questions).coerceAtMost(1f)

@Composable
private fun StepSegment(part: DayPart) {
    val step = part.step

    Segment(title = blockTitle(step), facts = segmentFacts(part), note = kindNote(step.learnKind), kind = step.learnKind)
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
private fun segmentFacts(part: DayPart): String {
    val step = part.step
    val locale = currentLocale()
    val time = formatMinutes(step.estimatedMinutes.toInt(), locale)

    return when (part.state) {
        DayPart.State.Done -> {
            stringResource(R.string.today_step_done)
        }

        DayPart.State.Ahead -> {
            time
        }

        DayPart.State.Current -> {
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
