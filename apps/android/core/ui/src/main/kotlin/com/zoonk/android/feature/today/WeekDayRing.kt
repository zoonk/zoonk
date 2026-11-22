package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.GoalRing
import com.zoonk.android.ui.components.GoalRingTrack
import com.zoonk.android.ui.components.WEEK_RING
import com.zoonk.api.models.StudyWeekDay
import kotlinx.datetime.LocalDate

/** How much of a day's ring fills: its list's blocks done, whole once the day first finished. */
val StudyWeekDay.share: Float
    get() =
        when {
            hitGoal -> 1f
            total > 0 -> completed.toFloat() / total
            else -> 0f
        }

/** A past study day the learner didn't study. */
fun StudyWeekDay.isMissed(weekDate: LocalDate): Boolean = kind == StudyWeekDay.Kind.STUDY && !studied && !isToday && date < weekDate

private val StudyWeekDay.isOutsidePlan get() =
    !studied &&
        (kind == StudyWeekDay.Kind.BEFORE_START || kind == StudyWeekDay.Kind.AFTER_END)

/** A day's ring as Today's week, the Plan's week and the weekly recap draw it. [weekDate] is the learner's current day. */
@Composable
fun WeekDayRing(
    day: StudyWeekDay,
    weekDate: LocalDate,
    content: @Composable () -> Unit = {},
) {
    if (day.isOutsidePlan && !day.isToday) {
        Row(Modifier.size(WEEK_RING), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            HorizontalDivider(Modifier.size(width = 12.dp, height = 2.dp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f))
        }
        return
    }

    val isTarget = !day.studied && (day.kind == StudyWeekDay.Kind.EXAM || day.kind == StudyWeekDay.Kind.DEADLINE)
    val track =
        when {
            day.isToday -> GoalRingTrack.Today
            day.isMissed(weekDate) -> GoalRingTrack.Missed
            day.kind == StudyWeekDay.Kind.REST -> GoalRingTrack.Rest
            else -> GoalRingTrack.Default
        }

    GoalRing(day.share, track = track, size = WEEK_RING) {
        when {
            day.hitGoal -> DoneMark()
            isTarget -> Icon(painterResource(R.drawable.ic_school), contentDescription = null, modifier = Modifier.size(14.dp))
            else -> content()
        }
    }
}

/** What a day's ring says to TalkBack and in its popover. [exam] names the goal's date an exam. */
@Composable
fun weekDayStatus(
    day: StudyWeekDay,
    weekDate: LocalDate,
    exam: Boolean,
): String =
    stringResource(
        when {
            day.hitGoal -> R.string.today_week_goal_reached
            day.studied -> R.string.today_week_studied
            day.kind == StudyWeekDay.Kind.EXAM -> R.string.today_week_exam_day
            day.kind == StudyWeekDay.Kind.DEADLINE -> R.string.today_week_deadline
            day.kind == StudyWeekDay.Kind.BEFORE_START -> R.string.today_week_before_plan
            day.kind == StudyWeekDay.Kind.AFTER_END -> if (exam) R.string.today_week_after_exam else R.string.today_week_after_date
            day.kind == StudyWeekDay.Kind.REST -> R.string.today_week_rest_day
            day.isToday -> R.string.today_week_today
            day.date > weekDate -> R.string.today_week_planned
            else -> R.string.today_week_not_studied
        },
    )
