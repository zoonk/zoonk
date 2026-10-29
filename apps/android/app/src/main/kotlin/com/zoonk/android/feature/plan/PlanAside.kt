package com.zoonk.android.feature.plan

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanMockSchedule
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanSchedule
import com.zoonk.api.models.PlanSteering
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle

@Composable
internal fun NextOnPath(
    page: PlanPageState,
    links: PlanLinks,
    modifier: Modifier = Modifier,
) {
    val plan = page.plan
    val mockDate = plan.nextMockDate
    val checkpoint = plan.nextCheckpoint
    val chapter = if (page.isExam) null else plan.nextChapter
    val afterExam = plan.phases.filter { it.kind == PlanPhase.Kind.AFTER_EXAM }
    val hasNext = mockDate != null || chapter?.chapterId != null || checkpoint != null || afterExam.isNotEmpty()
    if (!hasNext && !page.isExam) return

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_next_on_path))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            mockDate?.let { MockRow(page, it, links) }
            chapter?.chapterId?.let { id ->
                val count =
                    PlanDateWords(
                        stringResource(R.string.plan_lessons_count, chapter.lessonsDone.toInt(), chapter.lessonsTotal.toInt()),
                        lessonsDoneSpoken(chapter.lessonsDone, chapter.lessonsTotal),
                    )
                ListRow(
                    headline = { Text(chapter.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                    onClick = { links.chapter(id.toString()) },
                    leading = { ChapterMark(chapter, isNext = true) },
                    meta = { TrailingText(count) },
                )
            }
            checkpoint?.let { CheckpointRow(page, it, links) }
            FinishRow(page, links)
            afterExam.forEach { AfterExamRow(page, it) }
        }
    }
}

@Composable
private fun FinishRow(
    page: PlanPageState,
    links: PlanLinks,
) {
    val finish = page.finish
    val date =
        when {
            finish != null -> planDate(finish.date, page.today, finish.estimate, finish.month).text
            page.isExam -> stringResource(R.string.plan_date_to_be_confirmed)
            else -> null
        }

    ListRow(
        headline = { Text(page.goal.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        onClick = if (links.hasExam) links::exam else null,
        leading = { FlagMark() },
        supporting = date?.let { { Text(it) } },
    )
}

@Composable
private fun AfterExamRow(
    page: PlanPageState,
    phase: PlanPhase,
) {
    val end = phase.end?.let { planDate(it, page.today, estimate = true, month = true) }
    val count = phase.mocks.count.toInt()
    val locked = count > 0 && page.mocksRequirePlus

    ListRow(
        headline = { Text(phaseName(phase, page.mocksRequirePlus)) },
        leading = { StatusMark(MarkStatus.Todo) },
        supporting = if (count > 0) ({ Text(mocksForNextSitting(page, count)) }) else null,
        meta =
            if (locked || end != null) {
                {
                    if (locked) PlusMark()
                    end?.let { TrailingText(it) }
                }
            } else {
                null
            },
    )
}

@Composable
private fun mocksForNextSitting(
    page: PlanPageState,
    count: Int,
): String {
    val sitting =
        page.plan.schedule.nextSitting
            ?.toJavaLocalDate()
    return if (sitting != null) {
        pluralStringResource(R.plurals.plan_mocks_next_sitting_on, count, count, formatPlanDate(sitting, page.today, currentLocale()))
    } else {
        pluralStringResource(R.plurals.plan_mocks_next_sitting, count, count)
    }
}

/** Other places the Plan leads; on wide windows the drawer lists them, so they show only where it doesn't. */
@Composable
internal fun MoreSection(
    links: PlanLinks,
    modifier: Modifier = Modifier,
) {
    if (!links.hasExam && !links.hasMindMaps) return

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_more))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            if (links.hasExam) LinkRow(R.drawable.ic_school, stringResource(R.string.plan_about_exam), links::exam)
            if (links.hasMindMaps) LinkRow(R.drawable.ic_lan, stringResource(R.string.plan_mind_maps), links::mindMaps)
        }
    }
}

@Composable
private fun LinkRow(
    icon: Int,
    text: String,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(text) },
        onClick = onClick,
        leading = { Icon(painterResource(icon), contentDescription = null) },
    )
}

/**
 * Main's "Your plan": the date, time a day, study days, mock exams, the exam's choices and what a
 * language plan practices. Each row opens Adjust plan at its section, once [onOpen] is given.
 */
@Composable
internal fun PlanProperties(
    page: PlanPageState,
    links: PlanLinks,
    modifier: Modifier = Modifier,
    onOpen: ((PlanSection) -> Unit)? = null,
) {
    val schedule = page.plan.schedule
    val locale = currentLocale()
    val adjust = stringResource(R.string.plan_adjust_plan)

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(stringResource(R.string.plan_your_plan))
        Column {
            PropertyRow(
                label = stringResource(if (page.isExam) R.string.plan_exam_date else R.string.plan_goal_date),
                value = goalDateValue(page),
                onClick = onOpen?.let { { it(PlanSection.Date) } },
                onClickLabel = adjust,
            )
            PropertyRow(
                stringResource(R.string.plan_time_a_day_label),
                dailyTimeValue(page),
                onOpen?.let { { it(PlanSection.Time) } },
                onClickLabel = adjust,
            )
            PropertyRow(
                stringResource(R.string.plan_study_days),
                studyDaysText(
                    schedule.weekdayMinutes.map {
                        it.toInt()
                    },
                    locale,
                ),
                onOpen?.let { { it(PlanSection.Days) } },
                onClickLabel = adjust,
            )
            schedule.mocks?.let { mocks ->
                PropertyRow(
                    label = stringResource(R.string.plan_mock_exams),
                    value = mockScheduleValue(page, mocks),
                    onClick = if (links.hasExam) links::exam else null,
                    onClickLabel = stringResource(R.string.plan_about_exam),
                    plus = page.mocksRequirePlus,
                )
            }
            page.plan.examChoices.forEach { choice ->
                val picked = choice.options.firstOrNull { it.name == choice.subject }
                PropertyRow(
                    label = choice.group,
                    value = picked?.let { it.shortName ?: it.name } ?: stringResource(R.string.plan_choose),
                    onClick = onOpen?.let { { it(PlanSection.Choices) } },
                    onClickLabel = adjust,
                    warning = picked == null,
                )
            }
            if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) {
                val skipped =
                    page.plan.steering.skippedActivities
                        .toSet()
                val practiced = PlanSteering.SkippedActivities.entries.filterNot { it in skipped }
                if (practiced.isNotEmpty()) {
                    PropertyRow(
                        label = stringResource(R.string.plan_practice),
                        value =
                            if (practiced.size == PlanSteering.SkippedActivities.entries.size) {
                                stringResource(R.string.plan_everything)
                            } else {
                                practiced.map { activityName(it) }.joinToString(" · ")
                            },
                        onClick = onOpen?.let { { it(PlanSection.Practice) } },
                        onClickLabel = adjust,
                    )
                }
            }
        }
    }
}

enum class PlanSection { Date, Time, Days, Choices, Practice }

@Composable
private fun PropertyRow(
    label: String,
    value: String,
    onClick: (() -> Unit)?,
    onClickLabel: String? = null,
    plus: Boolean = false,
    warning: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .bleed(LIST_ITEM_INSET)
                .then(
                    if (onClick != null) {
                        Modifier.clickable(onClickLabel = onClickLabel, role = Role.Button, onClick = onClick)
                    } else {
                        Modifier.semantics(mergeDescendants = true) {}
                    },
                ).heightIn(min = 48.dp)
                .padding(horizontal = LIST_ITEM_INSET, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(LABEL_SHARE),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            Modifier.weight(1 - LABEL_SHARE),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (plus) PlusMark()
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (warning) FontWeight.Medium else null,
                color = if (warning) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.End,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private const val LABEL_SHARE = 0.4f

@Composable
private fun goalDateValue(page: PlanPageState): String {
    val schedule = page.plan.schedule
    val target = schedule.targetDate ?: return stringResource(if (page.isExam) R.string.plan_to_be_confirmed else R.string.plan_no_date)
    return planDate(target.toJavaLocalDate(), page.today, schedule.targetDateEstimated, schedule.targetDateNamedMonth).text
}

@Composable
private fun dailyTimeValue(page: PlanPageState): String {
    val locale = currentLocale()
    val shape = page.plan.schedule.weekShape
    val weekdays = formatMinutes(shape.weekdays, locale)
    return shape.weekend?.let { stringResource(R.string.plan_time_weekends, weekdays, formatMinutes(it, locale)) } ?: weekdays
}

/** Core's `getWeekShape`: a study weekday's time is the most common one, so one shorter day isn't the week's. */
internal data class WeekShape(
    val weekdays: Int,
    val weekend: Int?,
    val weekdayDays: List<Int>,
    val weekendDays: List<Int>,
) {
    /** Only a week with both kinds of study day can give the weekend its own time. */
    val canDiffer: Boolean get() = weekdayDays.isNotEmpty() && weekendDays.isNotEmpty()
}

internal val PlanSchedule.weekShape: WeekShape
    get() = weekShape(weekdayMinutes.map { it.toInt() }, dailyMinutes.toInt())

internal fun weekShape(
    weekdayMinutes: List<Int>,
    dailyMinutes: Int,
): WeekShape {
    fun minutes(day: Int) = weekdayMinutes.getOrElse(day) { 0 }
    val weekdayDays = (1..5).filter { minutes(it) > 0 }
    val weekendDays = WEEKEND.filter { minutes(it) > 0 }
    val weekdays = common(weekdayDays.map(::minutes)) ?: dailyMinutes
    val weekend = common(weekendDays.map(::minutes))
    val shape = WeekShape(weekdays, null, weekdayDays, weekendDays)
    return if (shape.canDiffer && weekend != weekdays) shape.copy(weekend = weekend) else shape
}

/** Sunday is 0, as the plan counts weekdays. */
internal fun isWeekend(weekday: Int) = weekday in WEEKEND

private val WEEKEND = listOf(0, 6)

/** The most common; the longer one on a tie. */
private fun common(minutes: List<Int>): Int? =
    minutes.maxWithOrNull(compareBy<Int> { value -> minutes.count { it == value } }.thenBy { it })

internal fun studyDaysText(
    weekdayMinutes: List<Int>,
    locale: java.util.Locale,
    everyDay: String = "",
    range: (String, String) -> String = { first, last -> "$first – $last" },
): String {
    val mondayFirst = (0 until DAYS_PER_WEEK).map { (it + 1) % DAYS_PER_WEEK }
    val days = mondayFirst.filter { weekdayMinutes.getOrElse(it) { 0 } > 0 }

    fun short(day: Int) = DayOfWeek.of(if (day == 0) DAYS_PER_WEEK else day).getDisplayName(TextStyle.SHORT, locale)
    val positions = days.map(mondayFirst::indexOf)
    val oneRun = positions.zipWithNext().all { (a, b) -> b == a + 1 }
    return when {
        days.size == DAYS_PER_WEEK -> everyDay
        days.size >= MIN_RANGE_DAYS && oneRun -> range(short(days.first()), short(days.last()))
        else -> days.joinToString(", ", transform = ::short)
    }
}

@Composable
private fun studyDaysText(
    weekdayMinutes: List<Int>,
    locale: java.util.Locale,
): String {
    val everyDay = stringResource(R.string.plan_every_day)
    val rangeFormat = stringResource(R.string.plan_day_range)
    return studyDaysText(weekdayMinutes, locale, everyDay) { first, last -> rangeFormat.format(first, last) }
}

private const val DAYS_PER_WEEK = 7
private const val MIN_RANGE_DAYS = 3

@Composable
private fun mockScheduleValue(
    page: PlanPageState,
    mocks: PlanMockSchedule,
): String {
    val weekday = mocks.weekday?.toInt()
    if (weekday != null) {
        val days = weekdaysWord(weekday)
        val every = mocks.everyWeeks?.toInt()
        return if (every != null && every > 1) pluralStringResource(R.plurals.plan_mocks_every_weeks, every, days, every) else days
    }
    val date = formatPlanDate(mocks.nextDate.toJavaLocalDate(), page.today, currentLocale())
    return if (mocks.count > 1) stringResource(R.string.plan_mocks_next, date) else date
}

/** "Sundays" … "Saturdays", Sunday counted 0 as the API counts it. */
@Composable
private fun weekdaysWord(weekday: Int): String =
    stringResource(
        when (weekday) {
            0 -> R.string.plan_sundays
            1 -> R.string.plan_mondays
            2 -> R.string.plan_tuesdays
            3 -> R.string.plan_wednesdays
            4 -> R.string.plan_thursdays
            5 -> R.string.plan_fridays
            else -> R.string.plan_saturdays
        },
    )

@Composable
internal fun activityName(activity: PlanSteering.SkippedActivities): String =
    stringResource(
        when (activity) {
            PlanSteering.SkippedActivities.VOCABULARY -> R.string.plan_activity_vocabulary
            PlanSteering.SkippedActivities.LISTENING -> R.string.plan_activity_listening
            PlanSteering.SkippedActivities.WRITING -> R.string.plan_activity_writing
            PlanSteering.SkippedActivities.SPEAKING -> R.string.plan_activity_speaking
        },
    )
