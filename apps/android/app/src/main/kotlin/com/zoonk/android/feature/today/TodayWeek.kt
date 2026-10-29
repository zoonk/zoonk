package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.GoalRing
import com.zoonk.android.ui.components.GoalRingTrack
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.StudySessionWeekDaysInner
import com.zoonk.api.models.TodayWeeklyChallenge
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.time.format.TextStyle
import kotlin.math.roundToInt

private typealias WeekDay = StudySessionWeekDaysInner

/** The week as rings (time studied against each day's goal), its time, and the week's challenge. */
@Composable
internal fun TodayWeek(
    day: DayView,
    challenge: TodayWeeklyChallenge?,
    onOpen: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val week = day.week
    // The week marks the current local day even while a lesson carries the previous day's session.
    val weekDate = week.days.firstOrNull { it.isToday }?.date ?: day.localDate
    val inWeek = challenge?.date != null && week.days.any { it.date == challenge.date }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        WeekHeader(day)

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            week.days.forEach { weekDay ->
                val challengeDay = challenge?.takeIf { it.date == weekDay.date }
                DayCell(weekDay, weekDate, challengeDay, Modifier.weight(1f))
            }
        }

        if (challenge != null && inWeek) ChallengeRow(challenge, onOpen)
    }
}

/** The week's time is a big number where there's room; on a phone it joins the days line. */
@Composable
private fun WeekHeader(day: DayView) {
    val days = day.week.days
    val studyDays = days.count { it.kind == StudySessionWeekDaysInner.Kind.STUDY || it.studied }
    val studied = days.count { it.studied }
    val locale = currentLocale()
    val time = day.week.time
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val studiedText = formatMinutes(time.studiedMinutes.toInt(), locale)
    val planned = formatMinutes(time.targetMinutes.roundToInt(), locale)
    val timeDescription = stringResource(R.string.today_week_time, studiedText, planned)
    val hasTime = time.targetMinutes > 0
    val daysText =
        if (studyDays >
            0
        ) {
            pluralStringResource(R.plurals.today_week_days, studyDays, formatNumber(studied.toDouble(), locale), studyDays)
        } else {
            null
        }

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.weight(1f)) {
            Text(
                stringResource(R.string.today_week_title),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
            )
            val line = listOfNotNull(daysText, if (hasTime && !wide) "$studiedText / $planned" else null).joinToString(" · ")
            if (line.isNotEmpty()) {
                Text(
                    text = line,
                    modifier =
                        if (hasTime &&
                            !wide
                        ) {
                            Modifier.semantics { contentDescription = listOfNotNull(daysText, timeDescription).joinToString(", ") }
                        } else {
                            Modifier
                        },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall.withTabularFigures(),
                )
            }
        }

        if (hasTime && wide) {
            Row(Modifier.clearAndSetSemantics { contentDescription = timeDescription }, verticalAlignment = Alignment.Bottom) {
                Text(studiedText, style = MaterialTheme.typography.titleLarge.withTabularFigures())
                Text(
                    text = " / $planned",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

@Composable
private fun DayCell(
    day: WeekDay,
    weekDate: LocalDate,
    challenge: TodayWeeklyChallenge?,
    modifier: Modifier,
) {
    val locale = currentLocale()
    val date = day.date.toJavaLocalDate()
    val weekday = date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, locale).replaceFirstChar { it.titlecase(locale) }
    val status = dayStatus(day, weekDate)
    val description =
        when {
            challenge == null -> stringResource(R.string.today_week_day, weekday, status)
            day.date > weekDate -> stringResource(R.string.today_week_day, weekday, challengeDayName(challenge))
            else -> stringResource(R.string.today_week_challenge_day, weekday, challengeDayName(challenge), status)
        }

    Column(
        modifier = modifier.heightIn(min = 48.dp).clearAndSetSemantics { contentDescription = description },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        DayRing(day, weekDate) {
            if (challenge != null && day.share == 0f) KindMark(challenge.kind())
        }
        Text(
            text = date.dayOfWeek.getDisplayName(TextStyle.NARROW_STANDALONE, locale).uppercase(locale),
            color = if (day.isToday) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (day.isToday) FontWeight.Medium else null,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun DayRing(
    day: WeekDay,
    weekDate: LocalDate,
    content: @Composable () -> Unit,
) {
    if (day.isOutsidePlan && !day.isToday) {
        Row(Modifier.size(RING), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            HorizontalDivider(Modifier.size(width = 12.dp, height = 2.dp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f))
        }
        return
    }

    val isTarget = !day.studied && (day.kind == StudySessionWeekDaysInner.Kind.EXAM || day.kind == StudySessionWeekDaysInner.Kind.DEADLINE)
    val track =
        when {
            day.isToday -> GoalRingTrack.Today
            day.isMissed(weekDate) -> GoalRingTrack.Missed
            day.kind == StudySessionWeekDaysInner.Kind.REST -> GoalRingTrack.Rest
            else -> GoalRingTrack.Default
        }

    GoalRing(day.share, track = track, size = RING) {
        when {
            day.hitGoal -> DoneMark()
            isTarget -> Icon(painterResource(R.drawable.ic_school), contentDescription = null, modifier = Modifier.size(14.dp))
            else -> content()
        }
    }
}

/** A day the plan gave no time that the learner studied anyway fills whole. */
private val WeekDay.share: Float
    get() =
        when {
            hitGoal -> 1f
            goalMinutes == 0.0 -> if (studied) 1f else 0f
            else -> (minutes / goalMinutes).toFloat().coerceAtMost(1f)
        }

private fun WeekDay.isMissed(weekDate: LocalDate) = kind == StudySessionWeekDaysInner.Kind.STUDY && !studied && !isToday && date < weekDate

private val WeekDay.isOutsidePlan get() =
    !studied &&
        (kind == StudySessionWeekDaysInner.Kind.BEFORE_START || kind == StudySessionWeekDaysInner.Kind.AFTER_END)

@Composable
private fun dayStatus(
    day: WeekDay,
    weekDate: LocalDate,
): String =
    stringResource(
        when {
            day.hitGoal -> R.string.today_week_goal_reached
            day.studied -> R.string.today_week_studied
            day.kind == StudySessionWeekDaysInner.Kind.EXAM -> R.string.today_week_exam_day
            day.kind == StudySessionWeekDaysInner.Kind.DEADLINE -> R.string.today_week_deadline
            day.kind == StudySessionWeekDaysInner.Kind.BEFORE_START -> R.string.today_week_before_plan
            day.kind == StudySessionWeekDaysInner.Kind.AFTER_END -> R.string.today_week_after_date
            day.kind == StudySessionWeekDaysInner.Kind.REST -> R.string.today_week_rest_day
            day.isToday -> R.string.today_week_today
            day.date > weekDate -> R.string.today_week_planned
            else -> R.string.today_week_not_studied
        },
    )

/** A mock the learner's plan doesn't include leaves its day to a full review of every topic. */
private val TodayWeeklyChallenge.isFullReview get() =
    kind == TodayWeeklyChallenge.Kind.MOCK &&
        access == TodayWeeklyChallenge.Access.PLUS_REQUIRED

private fun TodayWeeklyChallenge.kind(): LearnKind =
    when {
        isFullReview -> LearnKind.Review
        kind == TodayWeeklyChallenge.Kind.MOCK -> LearnKind.Mock
        else -> LearnKind.Challenge
    }

@Composable
private fun challengeDayName(challenge: TodayWeeklyChallenge): String =
    stringResource(
        when {
            challenge.isFullReview -> R.string.today_week_full_review_name
            challenge.kind == TodayWeeklyChallenge.Kind.MOCK -> R.string.today_week_mock_name
            else -> R.string.today_week_challenge_name
        },
    )

@Composable
private fun ChallengeRow(
    challenge: TodayWeeklyChallenge,
    onOpen: (AppRoute) -> Unit,
) {
    val date = challenge.date?.toJavaLocalDate() ?: return
    val locale = currentLocale()
    val weekday = formatDate(date, locale, DateStyle.Weekday, date).replaceFirstChar { it.titlecase(locale) }
    val planItem = challenge.planItemId
    val name: String
    val facts: List<String>

    if (challenge.isFullReview) {
        name = stringResource(R.string.session_block_full_review)
        facts = listOf(weekday, stringResource(R.string.today_week_full_review_detail))
    } else {
        name =
            stringResource(
                if (challenge.kind ==
                    TodayWeeklyChallenge.Kind.MOCK
                ) {
                    R.string.session_block_mock_exam
                } else {
                    R.string.session_block_weekly_challenge
                },
            )
        val questions = challenge.questions?.toInt()?.takeIf { it > 0 }
        facts =
            listOfNotNull(
                weekday,
                questions?.let { pluralStringResource(R.plurals.session_block_questions, it, it) },
                challenge.timeLimitMinutes?.let { formatMinutes(it.toInt(), locale) },
            )
    }

    val open = if (!challenge.isFullReview && planItem != null) ({ onOpen(AppRoute.Challenge(planItem.toString())) }) else null

    Column {
        HorizontalDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .then(if (open != null) Modifier.clickable(role = Role.Button, onClick = open) else Modifier)
                    .heightIn(min = 48.dp)
                    .padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            KindDot(challenge.kind())
            Column {
                Text(name, style = MaterialTheme.typography.titleSmall)
                Text(
                    facts.joinToString(" · "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private val RING = 30.dp
