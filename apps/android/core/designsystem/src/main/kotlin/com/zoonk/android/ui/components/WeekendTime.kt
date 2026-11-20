package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
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
 * Main's `WeekendTime`: the switch shows once the week has a weekend day and a weekday ([missing] names the days it
 * still needs), and the weekend's time shows only while it's on, right under it; off, the weekend takes the weekdays'
 * time. [timeEnabled] off waits for a save.
 */
@Composable
fun WeekendTime(
    checked: Boolean,
    missing: MissingDays?,
    times: List<Long>,
    minutes: Int,
    onCheckedChange: (Boolean) -> Unit,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
    labelStyle: TextStyle = MaterialTheme.typography.bodyLarge,
    timeEnabled: Boolean = true,
) {
    if (missing != null) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(checked, role = Role.Switch, onValueChange = onCheckedChange),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.weekend_time_differs), Modifier.weight(1f), style = labelStyle)
            Switch(checked = checked, onCheckedChange = null)
        }
        if (checked) {
            TimeSelect(
                label = stringResource(R.string.weekend_time_label),
                times = times,
                value = minutes,
                onPick = onPick,
                enabled = timeEnabled,
            )
        }
    }
}
