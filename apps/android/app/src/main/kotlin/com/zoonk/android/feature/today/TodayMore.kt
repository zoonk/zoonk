package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.TodayWeeklyChallenge
import kotlinx.datetime.toJavaLocalDate

/**
 * Under the day: more time once it's done or resting, catching up on what's behind, and, on a day
 * with nothing new, the week's challenge and practice with the buddy.
 */
@Composable
internal fun TodayMore(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    if (model.pastDate != null || model.keepLearning) return

    when (model.state) {
        DayState.Ahead -> {
            Column(modifier) {
                ChallengeLink(model, actions)
                LinkRow(
                    text = stringResource(R.string.today_practice_with_buddy, buddyName),
                    leading = { Icon(painterResource(R.drawable.ic_forum), contentDescription = null, modifier = Modifier.size(20.dp)) },
                ) { actions.navigate(AppRoute.Buddy()) }
            }
        }

        DayState.Done, DayState.Rest, DayState.Underway -> {
            Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (model.state != DayState.Underway) MoreTime(model, viewModel, actions)
                if (model.state != DayState.Rest) CatchUpLater(model, viewModel)
            }
        }

        DayState.Limit, DayState.Prepare, DayState.Waiting -> {}
    }
}

@Composable
private fun MoreTime(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
) {
    val extraTime = model.day.extraTime
    if (!extraTime.available) return

    val minutes = formatNumber(extraTime.minutes.toDouble(), currentLocale())
    val label = if (model.today.studiedToday) R.string.today_study_more_minutes else R.string.today_study_minutes

    OutlinedButton(onClick = actions.keepLearning, enabled = viewModel.pending == null) { Text(stringResource(label, minutes)) }
    if (viewModel.failed == TodayTap.KeepLearning) Failure(stringResource(R.string.today_save_failed))
}

/** Offered only while the lessons left take about one more day's time, so nobody is offered "+11 hr 52 min". */
@Composable
private fun CatchUpLater(
    model: TodayDayModel,
    viewModel: TodayViewModel,
) {
    val later = model.day.catchUp?.later ?: return
    val lessons = later.lessons.toInt()
    val examTomorrow = model.day.examTomorrow

    if (lessons == 0 || (examTomorrow && !later.offered)) return

    if (!later.offered) {
        Note(pluralStringResource(R.plurals.today_catch_up_next_days, lessons, lessons))
        return
    }

    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Note(
            if (examTomorrow) {
                pluralStringResource(R.plurals.today_catch_up_before_exam, lessons, lessons)
            } else {
                pluralStringResource(R.plurals.today_catch_up_tomorrow, lessons, lessons)
            },
        )
        OutlinedButton(onClick = { viewModel.catchUp(model.read) }, enabled = !viewModel.isCatchingUp) {
            Text(stringResource(R.string.today_catch_up_today, formatMinutes(later.minutes.toInt(), currentLocale())))
        }
    }
    if (viewModel.catchUpFailed) Failure(stringResource(R.string.today_save_failed))
}

@Composable
private fun ChallengeLink(
    model: TodayDayModel,
    actions: TodayActionHandlers,
) {
    val challenge = model.today.weeklyChallenge ?: return
    val date = challenge.date ?: return
    val planItemId = challenge.planItemId ?: return
    if (date < model.day.localDate) return

    val locale = currentLocale()
    val javaDate = date.toJavaLocalDate()
    val weekday = formatDate(javaDate, locale, DateStyle.Weekday, javaDate).replaceFirstChar { it.titlecase(locale) }
    val mock = challenge.kind == TodayWeeklyChallenge.Kind.MOCK

    LinkRow(
        text = stringResource(if (mock) R.string.today_see_day_mock else R.string.today_see_day_challenge, weekday),
        leading = { KindDot(if (mock) LearnKind.Mock else LearnKind.Challenge) },
        trailing = {
            if (challenge.access ==
                TodayWeeklyChallenge.Access.PLUS_REQUIRED
            ) {
                PlusMark()
            }
        },
    ) { actions.navigate(AppRoute.Challenge(planItemId.toString(), model.day.sessionId?.toString())) }
}

@Composable
private fun LinkRow(
    text: String,
    leading: @Composable () -> Unit,
    trailing: @Composable () -> Unit = {},
    onClick: () -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(
                        role = Role.Button,
                        onClick = onClick,
                    ).heightIn(min = 48.dp)
                    .padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RowMark(leading)
            Text(text, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            trailing()
        }
        HorizontalDivider()
    }
}

@Composable
private fun Note(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun Failure(text: String) {
    Text(
        text = text,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}
