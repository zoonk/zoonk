package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.CreateAccountButton
import com.zoonk.android.feature.subscription.GateLayout
import com.zoonk.android.feature.subscription.SubscribeButton

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

@Composable
fun limitWords(
    limit: Limit,
    subject: LimitSubject,
): LimitWords =
    when (limit) {
        is Limit.SlowDown -> LimitWords(title = null, line = stringResource(R.string.limit_slow_down))
        Limit.SignUpRequired -> LimitWords(title = stringResource(R.string.limit_sign_up_required), line = null)
        is Limit.Reached -> LimitWords(reachedTitle(limit, subject)?.let { stringResource(it) }, comesBackLine(limit))
    }

/** When it comes back; a guest's way on is the button, so their notice has no line. */
@Composable
fun comesBackLine(limit: Limit.Reached): String? =
    when (limit.tier) {
        LimitTier.Guest -> null
        LimitTier.Plus -> stringResource(if (limit.monthly) R.string.limit_more_next_month else R.string.limit_more_tomorrow)
        LimitTier.Free -> stringResource(if (limit.monthly) R.string.limit_more_next_month_or_subscribe else R.string.limit_more_tomorrow_or_subscribe)
    }

/** The lesson screen's line: what stays free, then when lessons come back. */
@Composable
fun stillReviewLine(limit: Limit.Reached): String =
    stringResource(
        when {
            limit.tier == LimitTier.Free && limit.monthly -> R.string.limit_still_review_more_next_month_or_subscribe
            limit.tier == LimitTier.Free -> R.string.limit_still_review_more_tomorrow_or_subscribe
            limit.monthly -> R.string.limit_still_review_more_next_month
            else -> R.string.limit_still_review_more_tomorrow
        },
    )

/** Calls have no title here: their screen already says what ran out. */
@StringRes
private fun reachedTitle(
    limit: Limit.Reached,
    subject: LimitSubject,
): Int? {
    val month = limit.monthly
    val guest = limit.tier == LimitTier.Guest

    return when (subject) {
        LimitSubject.Help -> if (guest) R.string.limit_help_guest else if (month) R.string.limit_help_month else R.string.limit_help_day
        LimitSubject.Messages -> if (guest) R.string.limit_help_guest else if (month) R.string.limit_messages_month else R.string.limit_messages_day
        LimitSubject.Explanations -> {
            if (guest) R.string.limit_help_guest else if (month) R.string.limit_explanations_month else R.string.limit_explanations_day
        }
        LimitSubject.Lessons -> {
            when {
                guest -> R.string.limit_lessons_guest
                limit.tier == LimitTier.Free && month -> R.string.limit_lessons_free_month
                month -> R.string.limit_lessons_month
                else -> R.string.limit_lessons_day
            }
        }
        LimitSubject.MindMaps -> if (guest) R.string.limit_mind_maps_guest else if (month) R.string.limit_mind_maps_month else R.string.limit_mind_maps_day
        LimitSubject.Outlines -> if (guest) R.string.limit_outlines_guest else if (month) R.string.limit_outlines_month else R.string.limit_outlines_day
        LimitSubject.Calls -> null
    }
}
