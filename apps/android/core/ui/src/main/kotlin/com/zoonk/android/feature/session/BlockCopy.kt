package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.feature.writing.gradingReturnsLine
import com.zoonk.android.feature.writing.writingTaskTitle
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.api.models.StudyBlock

/** Main's `getBlockKind`: practice that only fixes mistakes is the notebook's kind. */
val DayStep.learnKind: LearnKind
    get() {
        val checkpoint = checkpointFacts

        return when {
            checkpoint?.mock == true -> {
                LearnKind.Mock
            }

            checkpoint != null -> {
                LearnKind.Challenge
            }

            mistakesOnly || fromMistakes -> {
                LearnKind.Mistakes
            }

            else -> {
                when (kind) {
                    StudyBlock.Kind.CHECKPOINT -> LearnKind.Challenge
                    StudyBlock.Kind.LEARN -> LearnKind.Lesson
                    StudyBlock.Kind.PRACTICE -> LearnKind.Practice
                    StudyBlock.Kind.PRODUCE -> LearnKind.Essay
                    StudyBlock.Kind.REVIEW -> LearnKind.Review
                }
            }
        }
    }

/** A language unit's challenge is a live call with the Trickster, with no questions. */
private val DayStep.isCall: Boolean
    get() = checkpointFacts?.let { !it.mock && it.kind != CheckpointFacts.Kind.Weekly } == true && questions == 0L

/** The day's own work on the learner's mistakes: their missed questions, or a pattern in them. */
private val DayStep.fromMistakes: Boolean
    get() = screen == StudyBlock.Screen.MISTAKES_PRACTICE || screen == StudyBlock.Screen.PATTERN

/**
 * A day's mistakes block whose questions were all fixed elsewhere before it opened: it still opens,
 * says so and completes. A finished one keeps the count it recorded.
 */
val DayStep.alreadyFixed: Boolean
    get() = screen == StudyBlock.Screen.MISTAKES_PRACTICE && !isFinished && questions == 0L

/** Why a mistakes block or a returning lesson is in the day, said in place of what the row would say otherwise. */
@Composable
fun remedialLine(step: DayStep): String? =
    when {
        step.alreadyFixed -> null
        step.screen == StudyBlock.Screen.MISTAKES_PRACTICE -> stringResource(R.string.session_block_mistakes_line)
        step.screen == StudyBlock.Screen.PATTERN -> stringResource(R.string.session_block_pattern_line)
        step.kind != StudyBlock.Kind.LEARN -> null
        step.returning == StudyBlock.Returning.AGAIN -> stringResource(R.string.session_block_returning_again)
        step.returning == StudyBlock.Returning.ANOTHER_WAY -> stringResource(R.string.session_block_returning_another_way)
        step.returning == StudyBlock.Returning.MISSED -> stringResource(R.string.session_block_returning_missed)
        else -> null
    }

private val DayStep.hasCapsules: Boolean
    get() = kind == StudyBlock.Kind.REVIEW && capsules.isNotEmpty()

val DayStep.practisesTopics: Boolean
    get() = kind == StudyBlock.Kind.PRACTICE && topics.isNotEmpty() && !fullReview && !mistakesOnly

@Composable
fun blockTitle(step: DayStep): String {
    val checkpoint = step.checkpointFacts

    return when {
        checkpoint != null -> {
            when {
                checkpoint.kind == CheckpointFacts.Kind.Weekly && checkpoint.mock -> stringResource(R.string.session_block_mock_exam)
                checkpoint.kind == CheckpointFacts.Kind.Weekly -> stringResource(R.string.session_block_weekly_challenge)
                step.isCall -> stringResource(R.string.session_block_call)
                checkpoint.rematch -> stringResource(R.string.session_block_rematch)
                else -> stringResource(R.string.checkpoint_trickster)
            }
        }

        step.kind == StudyBlock.Kind.REVIEW && !step.hasCapsules -> {
            stringResource(R.string.session_block_what_you_know)
        }

        step.kind == StudyBlock.Kind.REVIEW -> {
            stringResource(R.string.session_block_review)
        }

        step.kind == StudyBlock.Kind.LEARN -> {
            step.title ?: stringResource(R.string.session_block_new_lesson)
        }

        step.kind == StudyBlock.Kind.PRODUCE -> {
            writingTaskTitle(drill = step.drill, task = step.writingTask, fallback = step.title)
        }

        step.alreadyFixed -> {
            stringResource(R.string.mistakes_practice_already_fixed)
        }

        step.screen == StudyBlock.Screen.MISTAKES_PRACTICE -> {
            pluralStringResource(R.plurals.session_block_fix_mistakes, step.questions.toInt(), step.questions.toInt())
        }

        step.screen == StudyBlock.Screen.PATTERN -> {
            stringResource(R.string.session_block_practice_pattern, step.title.orEmpty())
        }

        step.fullReview -> {
            stringResource(R.string.session_block_review)
        }

        step.mistakesOnly -> {
            stringResource(R.string.session_block_practice_mistakes)
        }

        step.topics.isNotEmpty() -> {
            stringResource(R.string.session_block_practice_topic, step.topics.first())
        }

        step.areas.isNotEmpty() -> {
            stringResource(R.string.session_block_practice_areas, formatList(step.areas, currentLocale()))
        }

        else -> {
            stringResource(R.string.session_block_mixed_practice)
        }
    }
}

@Composable
fun blockDetail(step: DayStep): String? {
    val count = step.questions.toInt()
    if (step.alreadyFixed) return null
    remedialLine(step)?.let { return it }

    return when {
        // Nothing was due, so the day reviews the weakest topics: never called due.
        step.hasCapsules && step.weakest -> {
            pluralStringResource(R.plurals.session_block_weakest, count, count)
        }

        step.hasCapsules -> {
            pluralStringResource(R.plurals.session_block_review_topics, count, count, shortTopicList(step.capsules.map { it.title }))
        }

        step.kind == StudyBlock.Kind.LEARN -> {
            if (step.reinforcement) stringResource(R.string.session_block_rematch_lesson) else step.canDo
        }

        step.isCall -> {
            null
        }

        step.checkpoint != null -> {
            pluralStringResource(R.plurals.session_block_questions, count, count)
        }

        step.kind == StudyBlock.Kind.PRODUCE -> {
            when (step.writing) {
                WritingRow.Tomorrow -> gradingReturnsLine(step.writingReturnsOn)
                WritingRow.DraftSaved -> stringResource(R.string.session_block_writing_draft_saved)
                null -> if (step.drill) stringResource(R.string.essay_short_exercise_detail) else step.canDo
            }
        }

        step.fullReview -> {
            pluralStringResource(R.plurals.session_block_full_review_questions, count, count)
        }

        step.practisesTopics -> {
            pluralStringResource(R.plurals.session_block_review_topics, count, count, shortTopicList(step.topics, named = 2))
        }

        else -> {
            pluralStringResource(R.plurals.session_block_questions, count, count)
        }
    }
}

/**
 * Topics drop a notice's numbering ("12 Noções…" read as a count), and only the first few are
 * named.
 */
@Composable
fun shortTopicList(
    topics: List<String>,
    named: Int = NAMED,
): String {
    val names = topics.map(::topicWords)
    val shown = names.take(named)
    val rest = names.size - shown.size
    val locale = currentLocale()

    return if (rest == 0) {
        formatList(shown, locale)
    } else {
        pluralStringResource(R.plurals.session_topics_and_more, rest, shown.joinToString(", "), rest)
    }
}

/** "1", "1.1", "5.7.": a notice's item number, never a year opening a topic ("2026 in numbers"). */
private val ITEM_NUMBER = Regex("""^\s*(\d{1,3}(?:\.\d{1,3})*)\.?\s+(\S.*)$""", RegexOption.DOT_MATCHES_ALL)

/** A sub-item's code some notices write instead of a number: ENEM's "H18 - Identify…". */
private val ITEM_CODE = Regex("""^\s*([A-Z]{1,3}\d{1,3})\s*[-–—:]\s+(\S.*)$""", RegexOption.DOT_MATCHES_ALL)

internal fun topicWords(name: String): String =
    ITEM_NUMBER.find(name)?.groupValues?.get(2)
        ?: ITEM_CODE.find(name)?.groupValues?.get(2)
        ?: name

private const val NAMED = 3

/** The Trickster is a phase's boss: the week's challenge and mocks wear their kind's mark. */
@Composable
fun BlockMark(step: DayStep) {
    val checkpoint = step.checkpointFacts

    when {
        step.status == StudyBlock.Status.COMPLETED -> DoneMark()
        step.status == StudyBlock.Status.SKIPPED -> StatusMark(MarkStatus.Skipped)
        checkpoint != null && !checkpoint.mock && checkpoint.kind != CheckpointFacts.Kind.Weekly -> Trickster(Modifier.size(markSize()))
        else -> KindMark(step.learnKind)
    }
}

/** Under the title of a row whose tap couldn't open its block. */
@Composable
fun StepOpenFailed() {
    Text(
        text = stringResource(R.string.today_step_open_failed),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
    )
}
