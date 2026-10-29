package com.zoonk.android.feature.missions

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.StudyMission.Kind

@Composable
fun missionName(
    mission: DayMission,
    buddyName: String,
): String {
    val detail = mission.detail

    return when (mission.kind) {
        Kind.REVIEW -> {
            stringResource(R.string.missions_review)
        }

        Kind.SOMETHING_NEW -> {
            stringResource(R.string.missions_something_new)
        }

        Kind.FINISH_CHAPTER -> {
            detail?.chapterTitle?.let { stringResource(R.string.missions_finish_chapter_named, it) }
                ?: stringResource(R.string.missions_finish_chapter)
        }

        Kind.CHALLENGE -> {
            stringResource(if (detail?.rematch == true) R.string.missions_rematch else R.string.missions_challenge)
        }

        Kind.WEEKLY_CHALLENGE -> {
            stringResource(R.string.missions_weekly_challenge)
        }

        Kind.MOCK -> {
            stringResource(R.string.missions_mock)
        }

        Kind.ESSAY -> {
            stringResource(R.string.missions_essay)
        }

        Kind.PRACTICE -> {
            stringResource(R.string.missions_practice)
        }

        Kind.FIX_MISTAKE -> {
            val count = mission.total.toInt()
            if (count ==
                1
            ) {
                stringResource(R.string.missions_fix_a_mistake)
            } else {
                pluralStringResource(R.plurals.missions_fix_mistakes, count, count)
            }
        }

        Kind.PATTERN -> {
            stringResource(R.string.missions_pattern)
        }

        Kind.PRONUNCIATION -> {
            stringResource(R.string.missions_pronunciation)
        }

        Kind.CALL -> {
            stringResource(R.string.missions_call)
        }

        Kind.ASK_BUDDY -> {
            stringResource(R.string.missions_ask_buddy, buddyName)
        }

        Kind.WEAK_SPOT -> {
            detail?.areaTitle?.let { stringResource(R.string.missions_practice_area, it) }
                ?: stringResource(R.string.missions_practice)
        }
    }
}

/** What TalkBack says a tap does, or null when the mission opens nothing. */
@Composable
fun missionOpenLabel(
    mission: DayMission,
    buddyName: String,
): String? {
    val opens = mission.opens?.takeIf { !mission.done && mission.waitReason == null } ?: return null

    return when (mission.kind) {
        Kind.REVIEW -> {
            stringResource(R.string.missions_open_review)
        }

        Kind.SOMETHING_NEW -> {
            stringResource(R.string.missions_open_new_lesson)
        }

        Kind.FINISH_CHAPTER -> {
            stringResource(R.string.missions_open_chapter)
        }

        Kind.CHALLENGE, Kind.WEEKLY_CHALLENGE -> {
            stringResource(R.string.missions_open_challenge)
        }

        Kind.MOCK -> {
            stringResource(
                if (opens ==
                    MissionOpens.MockChooser
                ) {
                    R.string.missions_open_mock_chooser
                } else {
                    R.string.missions_open_mock
                },
            )
        }

        Kind.ESSAY -> {
            stringResource(R.string.missions_open_essay)
        }

        Kind.PRACTICE, Kind.WEAK_SPOT -> {
            stringResource(R.string.missions_open_practice)
        }

        Kind.FIX_MISTAKE -> {
            stringResource(R.string.missions_open_mistakes)
        }

        Kind.PATTERN -> {
            stringResource(R.string.missions_open_pattern)
        }

        Kind.PRONUNCIATION -> {
            stringResource(R.string.missions_open_pronunciation)
        }

        Kind.CALL -> {
            stringResource(R.string.missions_open_call)
        }

        Kind.ASK_BUDDY -> {
            stringResource(R.string.missions_open_buddy, buddyName)
        }
    }
}

/** Kinds whose minutes are an estimate of work outside the session. */
private val ESTIMATED = setOf(Kind.ASK_BUDDY, Kind.CALL, Kind.FIX_MISTAKE, Kind.PATTERN, Kind.PRONUNCIATION)

/** The mission's line under its name: its count, its step, and its minutes. */
@Composable
fun missionStepLine(
    mission: DayMission,
    block: DayStep?,
): String? {
    val locale = currentLocale()
    val count =
        if (mission.total >
            1
        ) {
            "${formatNumber(mission.progress.toDouble(), locale)}/${formatNumber(mission.total.toDouble(), locale)}"
        } else {
            null
        }
    val step = missionStep(mission, block)
    val minutes = mission.minutes?.takeIf { it > 0 }?.let { formatMinutes(it.toInt().coerceAtLeast(1), locale) }
    val time = minutes?.let { if (mission.kind in ESTIMATED) stringResource(R.string.missions_estimate, it) else it }

    return listOfNotNull(count, step, time).joinToString(" · ").ifEmpty { null }
}

@Composable
private fun missionStep(
    mission: DayMission,
    block: DayStep?,
): String? {
    val detail = mission.detail
    val wait = mission.waitReason

    return when {
        wait != null -> {
            stringResource(
                if (wait ==
                    com.zoonk.api.models.StudyMission.WaitReason.LESSONS
                ) {
                    R.string.missions_after_lessons
                } else {
                    R.string.missions_after_challenge
                },
            )
        }

        mission.kind == Kind.FIX_MISTAKE -> {
            stringResource(R.string.missions_from_notebook)
        }

        mission.kind == Kind.PATTERN -> {
            detail?.patternTitle
        }

        mission.kind == Kind.PRONUNCIATION -> {
            stringResource(R.string.missions_due_today)
        }

        mission.kind == Kind.CALL -> {
            detail?.chapterTitle?.let { stringResource(R.string.missions_quick_call_unit, it) }
                ?: stringResource(R.string.missions_quick_call)
        }

        mission.kind == Kind.ASK_BUDDY -> {
            stringResource(R.string.missions_ask_anything)
        }

        mission.kind == Kind.FINISH_CHAPTER -> {
            val title = detail?.title
            val left = (mission.total - mission.progress).toInt()
            val more = left - 1
            when {
                title == null && left == 1 -> stringResource(R.string.missions_last_lesson)
                title == null -> pluralStringResource(R.plurals.missions_last_lessons, left, left)
                more > 0 -> pluralStringResource(R.plurals.missions_lesson_and_more, more, title, more)
                else -> title
            }
        }

        detail?.title != null -> {
            detail.title
        }

        block != null && mission.kind != Kind.WEEKLY_CHALLENGE && mission.kind != Kind.MOCK -> {
            blockTitle(block)
        }

        mission.kind == Kind.REVIEW -> {
            stringResource(
                if ((mission.minutes ?: 0.0) >
                    QUICK_REVIEW_MAX_MINUTES
                ) {
                    R.string.session_block_reviews
                } else {
                    R.string.session_block_quick_review
                },
            )
        }

        mission.kind == Kind.SOMETHING_NEW -> {
            stringResource(R.string.missions_finish_new_lesson)
        }

        mission.kind == Kind.WEAK_SPOT -> {
            stringResource(R.string.missions_most_room)
        }

        else -> {
            null
        }
    }
}

/** The kind a mission's row wears when no block of the day stands for it; the buddy's face and the Trickster come with the characters. */
val DayMission.learnKind: LearnKind
    get() =
        when (kind) {
            Kind.ASK_BUDDY, Kind.CALL -> LearnKind.Conversation
            Kind.CHALLENGE, Kind.WEEKLY_CHALLENGE -> LearnKind.Challenge
            Kind.ESSAY -> LearnKind.Essay
            Kind.FINISH_CHAPTER, Kind.SOMETHING_NEW -> LearnKind.Lesson
            Kind.FIX_MISTAKE, Kind.PATTERN -> LearnKind.Mistakes
            Kind.MOCK -> LearnKind.Mock
            Kind.PRACTICE, Kind.WEAK_SPOT -> LearnKind.Practice
            Kind.PRONUNCIATION, Kind.REVIEW -> LearnKind.Review
        }

private const val QUICK_REVIEW_MAX_MINUTES = 5
