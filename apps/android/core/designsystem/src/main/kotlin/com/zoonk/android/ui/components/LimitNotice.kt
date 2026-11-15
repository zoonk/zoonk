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
    // Its day coming while it shows changes only its line; what's under the notice doesn't move for that.
    HeldSlot(gated = !limitLifted(limit), modifier) {
        GateLayout(words.title, words.line, buttons = if (limit.hasWayOn) ({ LimitActions(limit, onCreateAccount, onSubscribe) }) else null)
    }
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

/** Counted over the last 30 days, "a month" to the learner: each use comes back 30 days after it was made. */
private val Limit.Reached.rolling: Boolean
    get() = period == LimitPeriod.Rolling30Days

/** Used up for longer than a day: over the last 30 days, or for good. */
private val Limit.Reached.usedUp: Boolean
    get() = rolling || period == LimitPeriod.Total

private val Limit.Reached.freeLessons: Boolean
    get() = tier == LimitTier.Free && rolling

/**
 * When more comes back: the day of [Limit.Reached.availableAt] in the learner's calendar, "later today" or
 * "tomorrow" when it's that close, following the clock while it shows; a day's cap comes back tomorrow. Only a
 * free learner is offered to subscribe. None for a guest, whose way on is an account, for a cap used up for good,
 * or when the API gave no day (never a guessed one).
 */
@Composable
fun comesBackLine(limit: Limit.Reached): String? {
    val daily = limit.period == null || limit.period == LimitPeriod.Day
    val day = if (daily) OpeningDay.Tomorrow else rememberOpeningDay(limit.availableAt.takeIf { limit.rolling })
    val free = limit.tier == LimitTier.Free
    return when {
        limit.tier == LimitTier.Guest || day == null -> {
            null
        }

        day == OpeningDay.Open -> {
            stringResource(R.string.limit_try_again_now)
        }

        day == OpeningDay.Today -> {
            stringResource(if (free) R.string.limit_more_later_today_or_subscribe else R.string.limit_more_later_today)
        }

        day == OpeningDay.Tomorrow -> {
            stringResource(if (free) R.string.limit_more_tomorrow_or_subscribe else R.string.limit_more_tomorrow)
        }

        else -> {
            val date = formatDate((day as OpeningDay.On).date, currentLocale(), DateStyle.DayMonth)
            stringResource(if (free) R.string.limit_more_on_or_subscribe else R.string.limit_more_on, date)
        }
    }
}

/** A gate in one sentence, where there's room for only one (a toast, an error under a field): "{title}. {line}". */
@Composable
fun gateSentence(
    title: String,
    line: String?,
): String = line?.let { stringResource(R.string.limit_sentence, title, it) } ?: title

/**
 * The day a cap counted over the last 30 days gave has come while its gate shows: the gate's way to try is back,
 * so the next tap asks the server again, which decides. Never true for a day's cap or one with no day.
 */
@Composable
fun limitLifted(limit: Limit?): Boolean =
    limit is Limit.Reached && limit.rolling && rememberOpeningDay(limit.availableAt) == OpeningDay.Open

/** Whether a free learner's next lesson has opened since the refusal: the server then gets asked again (main's `useFreeLessonReady`). */
@Composable
fun freeLessonReady(limit: Limit): Boolean = limit is Limit.Reached && limit.freeLessons && limitLifted(limit)

/** Main's `useLessonLimitWords`: the free learner's month with the day more comes back, a guest's, or the day's. */
@Composable
private fun lessonWords(limit: Limit.Reached): LimitWords {
    val opens = rememberOpeningDay(limit.availableAt.takeIf { limit.freeLessons })
    return when {
        opens == OpeningDay.Open -> LimitWords(stringResource(R.string.limit_lesson_ready), line = null)
        limit.freeLessons -> LimitWords(stringResource(R.string.limit_lessons_free), comesBackLine(limit))
        limit.tier == LimitTier.Guest -> LimitWords(stringResource(R.string.limit_lessons_guest), line = null)
        else -> LimitWords(stringResource(R.string.limit_lessons_day), comesBackLine(limit))
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
        is OpeningDay.On -> stringResource(R.string.limit_map_enough_on, formatDate(day.date, currentLocale(), DateStyle.DayMonth))
    }

/** The lesson screen's line: what stays free, then when the next lesson comes, as the web joins them. */
@Composable
fun stillReviewLine(limit: Limit.Reached): String =
    listOfNotNull(stringResource(R.string.limit_still_review), lessonWords(limit).line).joinToString(" ")

/** Lessons read [lessonWords], a map's lessons [mapLessonsWords]. */
@StringRes
private fun reachedTitle(
    limit: Limit.Reached,
    subject: LimitSubject,
): Int? {
    val used = limit.usedUp
    val guest = limit.tier == LimitTier.Guest

    return when (subject) {
        LimitSubject.Help -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (used) {
                R.string.limit_help_used
            } else {
                R.string.limit_help_day
            }
        }

        LimitSubject.Messages -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (used) {
                R.string.limit_messages_used
            } else {
                R.string.limit_messages_day
            }
        }

        LimitSubject.Explanations -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (used) {
                R.string.limit_explanations_used
            } else {
                R.string.limit_explanations_day
            }
        }

        LimitSubject.MindMaps -> {
            if (guest) {
                R.string.limit_mind_maps_guest
            } else if (used) {
                R.string.limit_mind_maps_used
            } else {
                R.string.limit_mind_maps_day
            }
        }

        LimitSubject.Outlines -> {
            if (guest) {
                R.string.limit_outlines_guest
            } else if (used) {
                R.string.limit_outlines_used
            } else {
                R.string.limit_outlines_day
            }
        }

        LimitSubject.MockExams -> {
            if (guest) {
                R.string.limit_help_guest
            } else if (used) {
                R.string.limit_mock_exams_used
            } else {
                R.string.limit_help_day
            }
        }

        LimitSubject.Calls -> {
            when (limit.period) {
                LimitPeriod.Rolling30Days -> R.string.limit_call_time_used
                LimitPeriod.Total -> R.string.conversation_calls_need_account
                else -> R.string.conversation_no_calls_today
            }
        }

        LimitSubject.Lessons, LimitSubject.MapLessons -> {
            null
        }
    }
}
