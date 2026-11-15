package com.zoonk.android.feature.onboarding.setup

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.feature.ceremonies.MomentBuddy
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.ui.characters.ActReaction
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.SuccessEyebrow
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanItem
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.math.roundToLong

internal val LocalRevealBuddy = compositionLocalOf { MomentBuddy(BuddyLook(), "") }

@Composable
internal fun RevealHero(
    plan: Plan,
    goal: Goal,
    play: Boolean,
    today: LocalDate,
) {
    val buddy = LocalRevealBuddy.current
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SuccessEyebrow(stringResource(R.string.onboarding_reveal_created), iconModifier = Modifier.revealSettle(play))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(goal.displayName, Modifier.weight(1f), style = MaterialTheme.typography.headlineMedium)
            CelebrationScope(play) {
                BuddyActor(
                    buddy.look,
                    Modifier.size(80.dp),
                    reaction = ActReaction(BuddyAct.Cheer, 3 * ZoonkMotion.BEAT_MILLIS),
                    label = buddy.name,
                )
            }
        }
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
            val count = remember { Animatable(if (play) 0f else total.toFloat()) }
            LaunchedEffect(total, play) {
                if (play) {
                    count.animateTo(total.toFloat(), tween(700, delayMillis = ZoonkMotion.BEAT_MILLIS, easing = ZoonkMotion.EaseOut))
                } else {
                    count.snapTo(total.toFloat())
                }
            }
            RevealReadout(
                formatNumber(count.value.roundToLong().toDouble(), currentLocale()),
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
                        aim.aim?.value.orEmpty(),
                        facts.end
                            ?.let {
                                stringResource(R.string.onboarding_aim_by_month, formatDate(it, currentLocale(), DateStyle.MonthShort))
                            }.orEmpty(),
                    )
                }

                facts.days != null -> {
                    RevealReadout(
                        formatNumber(facts.days.toDouble(), currentLocale()),
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
    play: Boolean,
    onOpenStep: ((DayView, DayStep) -> Unit)? = null,
    openingStep: Long? = null,
    failedStep: Long? = null,
) {
    val started = day.steps.any { it.isFinished }
    val ordered = day.steps.filter { it.isFinished } + day.steps.filterNot { it.isFinished }
    Column {
        SectionHeader(
            stringResource(R.string.today_title),
            detail =
                listOf(
                    formatDate(day.localDate.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDayShort),
                    formatMinutes(minutes.toInt(), currentLocale()),
                ).factsLine(),
        )
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
                                stringResource(if (started) R.string.onboarding_reveal_up_next else R.string.onboarding_reveal_start_here),
                                Modifier.revealSettle(play, 2 * ZoonkMotion.BEAT_MILLIS),
                                color = MaterialTheme.colorScheme.tertiary,
                            )
                        }
                    } else {
                        null
                    },
            )
        }
    }
}

/**
 * Main's `RevealWeek`: the six days after today. Each row reads as a table row: the date is a lead as
 * wide as the week's longest, never wrapping, and it, the first name and the kinds share the first line;
 * the names follow one per line. The kinds show only in a window wider than a phone's (main's `max-sm:hidden`).
 */
@Composable
internal fun RevealWeek(reveal: com.zoonk.api.models.PlanRevealToday) {
    val days = reveal.nextDays
    if (days.none { it.items.isNotEmpty() }) return
    val locale = currentLocale()
    val dateStyle = MaterialTheme.zoonkType.data.copy(fontSize = MaterialTheme.typography.bodySmall.fontSize)
    val dates = days.map { formatDate(it.date.toJavaLocalDate(), locale, DateStyle.WeekdayDayOfMonth) }
    val measurer = rememberTextMeasurer()
    val dateWidth = with(LocalDensity.current) { dates.maxOf { measurer.measure(it, dateStyle, softWrap = false).size.width }.toDp() }
    Column {
        SectionHeader(
            stringResource(R.string.onboarding_reveal_first_week),
            detail =
                listOf(
                    pluralStringResource(R.plurals.onboarding_days, reveal.week.days.toInt(), reveal.week.days.toInt()),
                    formatMinutes(reveal.week.minutes.toInt(), locale),
                ).factsLine(),
        )
        val kinds = windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
        days.forEachIndexed { index, day ->
            val teaching = day.items.filter { it.kind == PlanItem.Kind.LESSON || it.kind == PlanItem.Kind.CHAPTER }
            val names = teaching.ifEmpty { day.items }
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
                leadOnFirstLine = true,
                headline = {
                    if (day.items.isEmpty()) {
                        Text(
                            stringResource(R.string.onboarding_reveal_rest_day),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        names.forEach { Text(revealItemTitle(it)) }
                    }
                },
                trailing = if (kinds && day.items.isNotEmpty()) ({ DayKinds(day.items) }) else null,
            )
            ListDivider()
        }
    }
}

/** Main's `DayKinds`: up to four kinds, then "+N", which TalkBack skips: the names already say them. */
@Composable
private fun DayKinds(items: List<PlanItem>) {
    Row(
        Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.take(KINDS_SHOWN).forEach { KindMark(it.revealKind(), Modifier.size(12.dp)) }
        if (items.size > KINDS_SHOWN) {
            Text(
                stringResource(R.string.onboarding_reveal_more_kinds, formatNumber((items.size - KINDS_SHOWN).toDouble(), currentLocale())),
                color = MaterialTheme.zoonk.faint,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

private const val KINDS_SHOWN = 4

@Composable
private fun revealItemTitle(item: PlanItem): String =
    when (item.kind) {
        PlanItem.Kind.REVIEW -> stringResource(R.string.onboarding_reveal_review)
        PlanItem.Kind.MOCK -> stringResource(R.string.onboarding_reveal_mock)
        PlanItem.Kind.CHECKPOINT, PlanItem.Kind.BOSS -> stringResource(R.string.onboarding_reveal_challenge)
        else -> item.title.ifBlank { stringResource(R.string.onboarding_reveal_more_lessons) }
    }

private fun PlanItem.revealKind(): LearnKind =
    when (kind) {
        PlanItem.Kind.REVIEW -> LearnKind.Review
        PlanItem.Kind.MOCK -> LearnKind.Mock
        PlanItem.Kind.CHECKPOINT, PlanItem.Kind.BOSS -> LearnKind.Challenge
        else -> LearnKind.Lesson
    }

@Composable
private fun Modifier.revealSettle(
    play: Boolean,
    delayMillis: Int = 0,
): Modifier {
    val scale = remember { Animatable(if (play) 0.5f else 1f) }
    LaunchedEffect(play) {
        if (play && currentCoroutineContext()[MotionDurationScale]?.scaleFactor != 0f) {
            scale.animateTo(1f, tween(650, delayMillis = delayMillis, easing = ZoonkMotion.EaseSpring))
        } else {
            scale.snapTo(1f)
        }
    }
    return graphicsLayer {
        scaleX = scale.value
        scaleY = scale.value
    }
}
