package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/** The study days a weekend time of its own needs: a weekend day to use it, and a weekday whose time it differs from. */
enum class MissingDays { Weekend, Weekdays }

/** Main's `getMissingDays`, the plan's weekdays counted from Sunday (0) to Saturday (6). */
fun missingDays(days: Collection<Int>): MissingDays? =
    when {
        days.none(::isWeekendDay) -> MissingDays.Weekend
        days.all(::isWeekendDay) -> MissingDays.Weekdays
        else -> null
    }

private fun isWeekendDay(day: Int) = day == 0 || day == 6

/**
 * Main's `WeekendTime`: always there, so a switch or a day's pick moves nothing. Off, its time is disabled and
 * shows [weekdayMinutes], which the weekend takes then. While the switch can't turn on ([missing] names the days
 * it needs), the time's room says why, and the switch's state reads it. [timeEnabled] off waits for a save.
 */
@Composable
fun WeekendTime(
    checked: Boolean,
    missing: MissingDays?,
    times: List<Long>,
    minutes: Int,
    weekdayMinutes: Int,
    onCheckedChange: (Boolean) -> Unit,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
    labelStyle: TextStyle = MaterialTheme.typography.bodyLarge,
    timeEnabled: Boolean = true,
) {
    val on = checked && missing == null
    val reason =
        missing?.let {
            stringResource(if (it == MissingDays.Weekend) R.string.weekend_time_add_weekend_day else R.string.weekend_time_add_weekday)
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(on, enabled = missing == null, role = Role.Switch, onValueChange = onCheckedChange)
                    .semantics { reason?.let { stateDescription = it } },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                stringResource(R.string.weekend_time_differs),
                Modifier.weight(1f),
                color = if (missing == null) Color.Unspecified else MaterialTheme.colorScheme.onSurface.copy(alpha = DISABLED_ALPHA),
                style = labelStyle,
            )
            Switch(checked = on, onCheckedChange = null, enabled = missing == null)
        }
        // The reason takes the time's room, which stays laid out under it, so a day's pick moves nothing.
        Box(contentAlignment = Alignment.CenterStart) {
            TimeSelect(
                label = stringResource(R.string.weekend_time_label),
                times = times,
                value = if (on) minutes else weekdayMinutes,
                onPick = onPick,
                modifier = if (reason == null) Modifier else Modifier.alpha(0f).clearAndSetSemantics {},
                enabled = on && timeEnabled,
            )
            reason?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

private const val DISABLED_ALPHA = 0.38f
