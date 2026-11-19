package com.zoonk.android.feature.onboarding.setup

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.ceremonies.MomentBuddy
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.ui.characters.ActReaction
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.StandingBuddy
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.SuccessEyebrow
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanDay
import com.zoonk.api.models.PlanItem
import com.zoonk.api.models.PlanRevealToday
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Main's `RevealReadouts`: the plan's figures between two rules. */
@Composable
internal fun RevealReadouts(
    plan: Plan,
    goal: Goal,
    today: LocalDate,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider()
        FlowRow(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            RevealReadout(
                formatMinutes(
                    plan.schedule.shape.weekdays
                        .toInt(),
                    currentLocale(),
                ),
                plan.schedule.shape.weekend?.let {
                    stringResource(
                        R.string.onboarding_reveal_weekends,
                        formatMinutes(it.toInt(), currentLocale()),
                    )
                }
                    ?: stringResource(R.string.onboarding_reveal_a_day),
            )
            val total = plan.revealPhases.sumOf { it.lessonsTotal }
            val done = plan.revealPhases.sumOf { it.lessonsDone }
            RevealReadout(
                formatNumber(total.toDouble(), currentLocale()),
                if (done >
                    0
                ) {
                    pluralStringResource(
                        R.plurals.onboarding_reveal_lessons_done,
                        total.coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
                        formatNumber(done.toDouble(), currentLocale()),
                    )
                } else {
                    pluralStringResource(R.plurals.onboarding_reveal_lessons, total.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
                },
            )
            val facts = plan.revealFacts(today)
            val aim = plan.languageAim?.takeIf { facts.days == null && it.choices.any { choice -> choice.aim.value == it.aim?.value } }
            when {
                aim != null -> {
                    RevealReadout(
                        aim.label ?: aim.aim?.value.orEmpty(),
                        facts.end
                            ?.let {
                                stringResource(R.string.onboarding_aim_by_month, formatDate(it, currentLocale(), DateStyle.MonthShort))
                            }.orEmpty(),
                    )
                }

                facts.days != null -> {
                    RevealReadout(
                        pluralStringResource(
                            if (facts.daysEstimated) R.plurals.onboarding_reveal_days_estimated else R.plurals.onboarding_reveal_days,
                            facts.days,
                            formatNumber(facts.days.toDouble(), currentLocale()),
                        ),
                        stringResource(
                            if (goal.kind ==
                                Goal.Kind.EXAM
                            ) {
                                R.string.onboarding_reveal_until_exam
                            } else {
                                R.string.onboarding_reveal_until_date
                            },
                        ),
                    )
                }

                facts.end != null -> {
                    RevealReadout(
                        formatDate(facts.end, currentLocale(), DateStyle.MonthShort),
                        stringResource(R.string.onboarding_reveal_estimated_finish),
                    )
                }
            }
        }
        HorizontalDivider()
    }
}

@Composable
private fun RevealReadout(
    value: String,
    label: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(value, style = MaterialTheme.typography.headlineSmall.withTabularFigures())
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
internal fun RevealToday(
    day: DayView,
    minutes: Long,
    onOpenStep: ((DayView, DayStep) -> Unit)? = null,
    openingStep: Long? = null,
    failedStep: Long? = null,
) {
    val started = day.steps.any { it.isFinished }
    val unfinished = day.steps.filterNot { it.isFinished }
    val nextIndex = unfinished.indexOfFirst { it.position == day.nextPosition }
    val after = if (nextIndex < 0) emptyList() else unfinished.drop(nextIndex + 1)
    var moreOpen by rememberSaveable { mutableStateOf(false) }
    val hidden = (after.size - com.zoonk.android.feature.today.UPCOMING_ROWS).coerceAtLeast(0)
    val ordered = day.steps.filter { it.isFinished } + unfinished.dropLast(if (moreOpen) 0 else hidden)
    Column {
        SectionHeader(
            stringResource(R.string.today_title),
            detail =
                listOf(
                    formatDate(day.localDate.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDayOfMonth),
                    formatMinutes(minutes.toInt(), currentLocale()),
                ).factsLine(),
        )
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            ordered.forEachIndexed { index, step ->
                val tagged = step.position == day.nextPosition
                com.zoonk.android.feature.today.DayStepRow(
                    day,
                    step,
                    tagged,
                    onOpen = onOpenStep?.takeIf { step.canOpen }?.let { { it(day, step) } },
                    busy = openingStep == step.position,
                    openFailed = failedStep == step.position,
                    divider = index != ordered.lastIndex,
                    tag =
                        if (tagged) {
                            {
                                Text(
                                    stringResource(
                                        if (started) R.string.onboarding_reveal_up_next else R.string.onboarding_reveal_start_here,
                                    ),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        } else {
                            null
                        },
                )
            }
            if (hidden > 0) {
                com.zoonk.android.feature.today.FoldRow(
                    label =
                        if (moreOpen) {
                            stringResource(R.string.today_show_less)
                        } else {
                            val lessonsOnly =
                                after.drop(com.zoonk.android.feature.today.UPCOMING_ROWS).all {
                                    it.kind ==
                                        StudyBlock.Kind.LEARN
                                }
                            pluralStringResource(
                                if (lessonsOnly) R.plurals.today_more_lessons else R.plurals.today_more_count,
                                hidden,
                                hidden,
                            )
                        },
                    done = false,
                    open = moreOpen,
                    onToggle = { moreOpen = !moreOpen },
                    modifier = Modifier.padding(horizontal = LIST_ITEM_INSET),
                )
            }
        }
    }
}

/** Today in one line ("6 lessons · 41 min"), for a week whose Today shows its lessons elsewhere. */
@Composable
internal fun revealTodayLine(
    day: DayView,
    minutes: Long,
): String {
    val lessons = day.steps.count { it.lessonId != null }
    return (
        listOfNotNull(lessons.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.onboarding_course_lessons, it, it) }) +
            formatMinutes(minutes.toInt(), currentLocale())
    ).factsLine()
}

/**
 * Main's `RevealWeek`: the first week, its study days and time as core counts them (today among them when [today] lists
 * something), over Today and then each day after it on one line: the date, as wide as the week's longest and never
 * wrapping, then how many lessons, anything else the day holds and how long. The names wait for the Plan. With [todayLine],
 * Today's lessons show elsewhere and it's a row like the others.
 */
@Composable
internal fun RevealWeek(
    reveal: PlanRevealToday,
    todayLine: String? = null,
    today: @Composable () -> Unit = {},
) {
    val week = reveal.week
    val days = reveal.nextDays
    if (week.days == 0L) {
        today()
        return
    }
    val locale = currentLocale()
    val dateStyle = MaterialTheme.zoonkType.data.copy(fontSize = MaterialTheme.typography.bodySmall.fontSize)
    val todayLabel = stringResource(R.string.today_title)
    val dates = days.map { formatDate(it.date.toJavaLocalDate(), locale, DateStyle.WeekdayDayOfMonth) }
    val measurer = rememberTextMeasurer()
    val labels = if (todayLine == null) dates else listOf(todayLabel) + dates
    val dateWidth = with(LocalDensity.current) { labels.maxOf { measurer.measure(it, dateStyle, softWrap = false).size.width }.toDp() }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(
            stringResource(R.string.onboarding_reveal_first_week),
            detail =
                listOf(
                    pluralStringResource(R.plurals.onboarding_reveal_study_days, week.days.toInt(), week.days.toInt()),
                    formatMinutes(week.minutes.toInt(), locale),
                ).factsLine(),
        )
        today()
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            todayLine?.let {
                ListRow(
                    leading = {
                        Text(
                            todayLabel,
                            Modifier.widthIn(min = dateWidth),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = dateStyle,
                            maxLines = 1,
                            softWrap = false,
                        )
                    },
                    headline = { Text(it) },
                )
                if (days.isNotEmpty()) ListDivider()
            }
            days.forEachIndexed { index, day ->
                val lessons = day.items.sumOf { it.lessons.toInt() }
                val others =
                    day.items
                        .filterNot {
                            it.kind == PlanItem.Kind.LESSON || it.kind == PlanItem.Kind.CHAPTER
                        }.map { revealItemTitle(it) }
                        .distinct()
                val facts =
                    listOfNotNull(lessons.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.onboarding_course_lessons, it, it) }) +
                        others +
                        listOfNotNull(day.minutes.takeIf { it > 0 }?.let { formatMinutes(it.roundToInt(), locale) })
                ListRow(
                    leading = {
                        Text(
                            dates[index],
                            Modifier.widthIn(min = dateWidth),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = dateStyle,
                            maxLines = 1,
                            softWrap = false,
                        )
                    },
                    headline = {
                        if (day.items.isEmpty()) {
                            Text(
                                stringResource(R.string.onboarding_reveal_rest_day),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            Text(facts.factsLine())
                        }
                    },
                )
                if (index != days.lastIndex) ListDivider()
            }
        }
    }
}

@Composable
private fun revealItemTitle(item: PlanItem): String =
    when (item.kind) {
        PlanItem.Kind.REVIEW -> stringResource(R.string.onboarding_reveal_review)
        PlanItem.Kind.MOCK -> stringResource(R.string.onboarding_reveal_mock)
        PlanItem.Kind.CHECKPOINT, PlanItem.Kind.BOSS -> stringResource(R.string.onboarding_reveal_challenge)
        else -> item.title.ifBlank { stringResource(R.string.onboarding_reveal_more_lessons) }
    }
