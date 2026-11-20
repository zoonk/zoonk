package com.zoonk.android.feature.missions

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.ui.components.LearnKind
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

/** A mission's one line under its name: only a mission that waits has one. */
@Composable
fun missionStepLine(mission: DayMission): String? =
    if (mission.waitReason !=
        null
    ) {
        stringResource(R.string.missions_after_lessons)
    } else {
        null
    }

/** The kind a mission's row wears when no block of the day stands for it; the buddy's face and the Trickster come with the characters. */
val DayMission.learnKind: LearnKind get() = kind.learnKind

val Kind.learnKind: LearnKind
    get() =
        when (this) {
            Kind.ASK_BUDDY, Kind.CALL -> LearnKind.Conversation
            Kind.CHALLENGE, Kind.WEEKLY_CHALLENGE -> LearnKind.Challenge
            Kind.ESSAY -> LearnKind.Essay
            Kind.FINISH_CHAPTER, Kind.SOMETHING_NEW -> LearnKind.Lesson
            Kind.FIX_MISTAKE, Kind.PATTERN -> LearnKind.Mistakes
            Kind.MOCK -> LearnKind.Mock
            Kind.PRACTICE, Kind.WEAK_SPOT -> LearnKind.Practice
            Kind.PRONUNCIATION, Kind.REVIEW -> LearnKind.Review
        }
