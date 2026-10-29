package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
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

            mistakesOnly -> {
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

/** A phase challenge's own name (the phase), which the week's challenge doesn't have. */
val DayStep.challengePhase: String?
    get() = title?.takeIf { checkpointFacts?.let { it.kind != CheckpointFacts.Kind.Weekly } == true }

private val DayStep.hasCapsules: Boolean
    get() = kind == StudyBlock.Kind.REVIEW && capsules.isNotEmpty()

@Composable
fun blockTitle(step: DayStep): String {
    val checkpoint = step.checkpointFacts

    return when {
        checkpoint != null -> {
            when {
                checkpoint.kind == CheckpointFacts.Kind.Weekly && checkpoint.mock -> stringResource(R.string.session_block_mock_exam)
                checkpoint.kind == CheckpointFacts.Kind.Weekly -> stringResource(R.string.session_block_weekly_challenge)
                checkpoint.kind == CheckpointFacts.Kind.FinalBoss -> stringResource(R.string.session_block_final_challenge)
                checkpoint.rematch -> stringResource(R.string.session_block_challenge_rematch)
                else -> stringResource(R.string.session_block_phase_challenge)
            }
        }

        step.kind == StudyBlock.Kind.REVIEW && !step.hasCapsules -> {
            stringResource(R.string.session_block_what_you_know)
        }

        // Past this, "Quick review · 13 min" would read as a promise it didn't keep.
        step.kind == StudyBlock.Kind.REVIEW -> {
            stringResource(
                if (step.estimatedMinutes >
                    QUICK_REVIEW_MAX_MINUTES
                ) {
                    R.string.session_block_reviews
                } else {
                    R.string.session_block_quick_review
                },
            )
        }

        step.kind == StudyBlock.Kind.LEARN -> {
            step.title ?: stringResource(R.string.session_block_new_lesson)
        }

        step.kind == StudyBlock.Kind.PRODUCE -> {
            step.title ?: stringResource(R.string.session_block_writing_practice)
        }

        step.fullReview -> {
            stringResource(R.string.session_block_full_review)
        }

        step.mistakesOnly -> {
            stringResource(R.string.session_block_practice_mistakes)
        }

        else -> {
            stringResource(if (step.extra) R.string.session_block_bonus_practice else R.string.session_block_mixed_practice)
        }
    }
}

@Composable
fun blockDetail(step: DayStep): String? {
    val count = step.questions.toInt()
    val phase = step.challengePhase

    return when {
        // Nothing was due, so the day reviews the weakest topics: never called due.
        step.hasCapsules && step.weakest -> {
            pluralStringResource(R.plurals.session_block_weakest, count, count)
        }

        step.hasCapsules -> {
            val titles = shortTopicList(step.capsules.map { it.title })
            val reviewed = step.capsules.sumOf { it.questions }
            val known = step.questions > reviewed
            pluralStringResource(
                if (known) R.plurals.session_block_review_topics_and_known else R.plurals.session_block_review_topics,
                count,
                count,
                titles,
            )
        }

        step.kind == StudyBlock.Kind.LEARN -> {
            if (step.reinforcement) stringResource(R.string.session_block_rematch_lesson) else step.canDo
        }

        phase != null -> {
            pluralStringResource(R.plurals.session_block_phase_questions, count, count, phase)
        }

        step.checkpoint != null -> {
            pluralStringResource(R.plurals.session_block_challenge_questions, count, count)
        }

        step.kind == StudyBlock.Kind.PRODUCE -> {
            step.canDo
        }

        step.fullReview -> {
            pluralStringResource(R.plurals.session_block_full_review_questions, count, count)
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
fun shortTopicList(topics: List<String>): String {
    val names = topics.map(::topicWords)
    val named = names.take(NAMED)
    val rest = names.size - named.size
    val locale = currentLocale()

    return if (rest == 0) {
        formatList(named, locale)
    } else {
        pluralStringResource(R.plurals.session_topics_and_more, rest, named.joinToString(", "), rest)
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

private const val QUICK_REVIEW_MAX_MINUTES = 5
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
