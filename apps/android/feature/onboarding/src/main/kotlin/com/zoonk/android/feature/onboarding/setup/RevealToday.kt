package com.zoonk.android.feature.onboarding.setup

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.ceremonies.MomentBuddy
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
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
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
) {
    val buddy = LocalRevealBuddy.current
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SuccessEyebrow(stringResource(R.string.onboarding_reveal_created), iconModifier = Modifier.revealSettle(play))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(goal.title, Modifier.weight(1f), style = MaterialTheme.typography.headlineMedium)
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
            val facts =
                plan.revealFacts(
                    plan.nextDays
                        .firstOrNull()
                        ?.date
                        ?.toJavaLocalDate() ?: LocalDate.now(),
                )
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
    day: com.zoonk.android.feature.session.DayView,
    play: Boolean,
) {
    val started = day.steps.any { it.isFinished }
    val ordered = day.steps.filter { it.isFinished } + day.steps.filterNot { it.isFinished }
    Column {
        SectionHeader(
            stringResource(R.string.today_title),
            detail =
                listOf(
                    formatDate(day.localDate.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDayShort),
                    formatMinutes(day.minutes.dailyGoal.toInt(), currentLocale()),
                ).factsLine(),
        )
        ordered.forEachIndexed { index, step ->
            val tagged = step.position == day.nextPosition
            com.zoonk.android.feature.today.DayStepRow(
                day,
                step,
                tagged,
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

@Composable
internal fun RevealWeek(plan: Plan) {
    Column {
        SectionHeader(stringResource(R.string.onboarding_reveal_first_week))
        plan.nextDays.drop(1).forEach { day ->
            ListRow(
                headline = {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            formatDate(day.date.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDayShort),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall.withTabularFigures(),
                        )
                        if (day.items.isEmpty()) {
                            Text(stringResource(R.string.onboarding_reveal_rest_day))
                        } else {
                            day.items.forEach { Text(revealItemTitle(it)) }
                        }
                    }
                },
                trailing = {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        day.items.take(4).forEach { KindMark(it.revealKind()) }
                        if (day.items.size >
                            4
                        ) {
                            Text(
                                stringResource(
                                    R.string.onboarding_reveal_more_kinds,
                                    formatNumber((day.items.size - 4).toDouble(), currentLocale()),
                                ),
                            )
                        }
                    }
                },
            )
            ListDivider()
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
