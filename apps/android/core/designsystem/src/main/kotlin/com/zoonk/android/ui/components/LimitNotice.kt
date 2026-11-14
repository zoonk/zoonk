package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.CreateAccountButton
import com.zoonk.android.feature.subscription.GateLayout
import com.zoonk.android.feature.subscription.SubscribeButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate

/** What ran out as the title, and when it comes back as the one line under it. */
data class LimitWords(
    val title: String?,
    val line: String?,
)

/**
 * Main's limit notice, the gate's form for a cap: what ran out, when it comes back, and the way on:
 * "Create a free account" for a guest, "Subscribe" on Free, nothing when the limit only waits.
 */
@Composable
fun LimitNotice(
    limit: Limit,
    subject: LimitSubject,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val words = limitWords(limit, subject)
    GateLayout(words.title, words.line, modifier, if (limit.hasWayOn) ({ LimitActions(limit, onCreateAccount, onSubscribe) }) else null)
}

/** The limit's way on, for a screen that draws its own words. */
@Composable
fun LimitActions(
    limit: Limit,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
) {
    when {
        limit.needsAccount -> CreateAccountButton(onCreateAccount)
        limit.hasWayOn -> SubscribeButton(onSubscribe)
    }
}

val Limit.needsAccount: Boolean
    get() = this == Limit.SignUpRequired || (this is Limit.Reached && tier == LimitTier.Guest)

/** A guest can create an account and a free learner can subscribe; a subscriber or a slow-down only waits. */
val Limit.hasWayOn: Boolean
    get() = needsAccount || (this is Limit.Reached && tier == LimitTier.Free)

private val Limit.Reached.monthly: Boolean
    get() = period == LimitPeriod.Month || period == LimitPeriod.Total

/** A free learner's new lessons count their last 30 days (rule 16), so their gate gives the day the next one opens. */
private val Limit.Reached.freeLessons: Boolean
    get() = tier == LimitTier.Free && period == LimitPeriod.Rolling30Days

/** The day's sentence; none when the API gave no instant (never a guessed day) or the lesson is already open. */
@Composable
private fun opensLine(day: OpeningDay?): String? =
    when (day) {
        null, OpeningDay.Open -> null
        OpeningDay.Today -> stringResource(R.string.limit_lesson_opens_today)
        OpeningDay.Tomorrow -> stringResource(R.string.limit_lesson_opens_tomorrow)
        is OpeningDay.On -> stringResource(R.string.limit_lesson_opens_on, formatDate(day.date, currentLocale(), DateStyle.Long))
    }

/** Whether a free learner's next lesson has opened since the refusal: the server then gets asked again (main's `useFreeLessonReady`). */
@Composable
fun freeLessonReady(limit: Limit): Boolean =
    limit is Limit.Reached && limit.freeLessons && rememberOpeningDay(limit.availableAt) == OpeningDay.Open

/**
 * Main's `useLessonLimitWords`: the free learner's 30 days with the day the next lesson opens, a guest's,
 * or the day's; a lesson is never refused for a month.
 */
@Composable
private fun lessonWords(limit: Limit.Reached): LimitWords {
    val opens = rememberOpeningDay(limit.availableAt.takeIf { limit.freeLessons })
    return when {
        opens == OpeningDay.Open -> LimitWords(stringResource(R.string.limit_lesson_ready), line = null)
        limit.freeLessons -> LimitWords(stringResource(R.string.limit_lessons_free), opensLine(opens))
        limit.tier == LimitTier.Guest -> LimitWords(stringResource(R.string.limit_lessons_guest), line = null)
        else -> LimitWords(stringResource(R.string.limit_lessons_day), reachedLine(limit.tier, monthly = false))
    }
}

@Composable
fun limitWords(
    limit: Limit,
    subject: LimitSubject,
): LimitWords =
    when (limit) {
        is Limit.SlowDown -> {
            LimitWords(title = null, line = stringResource(R.string.limit_slow_down))
        }

        Limit.SignUpRequired -> {
            LimitWords(title = stringResource(R.string.limit_sign_up_required), line = null)
        }

        is Limit.Reached -> {
            when (subject) {
                LimitSubject.Lessons -> lessonWords(limit)
                LimitSubject.MapLessons -> mapLessonsWords(limit)
                else -> LimitWords(reachedTitle(limit, subject)?.let { stringResource(it) }, comesBackLine(limit))
            }
        }
    }

/** When it comes back; a guest's way on is the button, so their notice has no line. */
@Composable
fun comesBackLine(limit: Limit.Reached): String? = reachedLine(limit.tier, limit.monthly)

@Composable
private fun reachedLine(
    tier: LimitTier,
    monthly: Boolean,
): String? =
    when (tier) {
        LimitTier.Guest -> {
            null
        }

        LimitTier.Plus -> {
            stringResource(if (monthly) R.string.limit_more_next_month else R.string.limit_more_tomorrow)
        }

        LimitTier.Free -> {
            stringResource(
                if (monthly) R.string.limit_more_next_month_or_subscribe else R.string.limit_more_tomorrow_or_subscribe,
            )
        }
    }

/**
 * Main's `useMapLessonsWords`: a map writes its lessons first, so a free learner's map waits until all of
 * them fit in the lessons left over the last 30 days, and one that needs more than that never fits. The
 * learner may still have lessons left, so these words never say they used them.
 */
@Composable
private fun mapLessonsWords(limit: Limit.Reached): LimitWords {
    val opens = rememberOpeningDay(limit.availableAt.takeIf { limit.freeLessons })
    return when {
        !limit.freeLessons -> {
            LimitWords(
                stringResource(R.string.limit_map_needs_subscription),
                stringResource(R.string.limit_map_needs_subscription_line),
            )
        }

        opens == OpeningDay.Open -> {
            LimitWords(stringResource(R.string.limit_map_ready), line = null)
        }

        else -> {
            LimitWords(stringResource(R.string.limit_map_not_enough), mapOpensLine(opens))
        }
    }
}

@Composable
private fun mapOpensLine(day: OpeningDay?): String? =
    when (day) {
        null, OpeningDay.Open -> null
        OpeningDay.Today -> stringResource(R.string.limit_map_enough_today)
        OpeningDay.Tomorrow -> stringResource(R.string.limit_map_enough_tomorrow)
        is OpeningDay.On -> stringResource(R.string.limit_map_enough_on, formatDate(day.date, currentLocale(), DateStyle.Long))
    }

/** The lesson screen's line: what stays free, then when the next lesson comes, as the web joins them. */
@Composable
fun stillReviewLine(limit: Limit.Reached): String =
    listOfNotNull(stringResource(R.string.limit_still_review), lessonWords(limit).line).joinToString(" ")

/** Calls have no title here: their screen already says what ran out. Lessons read [lessonWords], a map's lessons [mapLessonsWords]. */
@StringRes
private fun reachedTitle(
    limit: Limit.Reached,
    subject: LimitSubject,
): Int? {
    val month = limit.monthly
    val guest = limit.tier == LimitTier.Guest

    return when (subject) {
        LimitSubject.Help -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (month) {
                R.string.limit_help_month
            } else {
                R.string.limit_help_day
            }
        }

        LimitSubject.Messages -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (month) {
                R.string.limit_messages_month
            } else {
                R.string.limit_messages_day
            }
        }

        LimitSubject.Explanations -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (month) {
                R.string.limit_explanations_month
            } else {
                R.string.limit_explanations_day
            }
        }

        LimitSubject.MindMaps -> {
            if (guest) {
                R.string.limit_mind_maps_guest
            } else if (month) {
                R.string.limit_mind_maps_month
            } else {
                R.string.limit_mind_maps_day
            }
        }

        LimitSubject.Outlines -> {
            if (guest) {
                R.string.limit_outlines_guest
            } else if (month) {
                R.string.limit_outlines_month
            } else {
                R.string.limit_outlines_day
            }
        }

        LimitSubject.Lessons, LimitSubject.MapLessons, LimitSubject.Calls -> {
            null
        }
    }
}
