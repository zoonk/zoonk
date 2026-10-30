package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures

/** Core's daily [times], with the ones shown among them. */
fun pickerTimes(
    times: List<Long>,
    vararg shown: Int?,
): List<Int> = (times.map(Long::toInt) + shown.filterNotNull()).distinct().sorted()

/** The daily times' menu, opened at the time [shown]. */
@Composable
fun TimeMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    times: List<Int>,
    shown: Int?,
    onPick: (Int) -> Unit,
    label: @Composable (Int) -> String = { formatMinutes(it, currentLocale()) },
) {
    val itemHeight = with(LocalDensity.current) { MENU_ITEM_HEIGHT.roundToPx() }
    val scroll = remember(expanded, shown) { ScrollState(times.indexOf(shown).coerceAtLeast(0) * itemHeight) }

    DropdownMenu(expanded = expanded, onDismissRequest = onDismissRequest, scrollState = scroll) {
        times.forEach { time ->
            DropdownMenuItem(
                text = { Text(label(time)) },
                onClick = {
                    onDismissRequest()
                    onPick(time)
                },
            )
        }
    }
}

/** Main's daily time picker: the big time a day, picked from core's [times]; its menu marks the time the plan [suggested]. */
@Composable
fun DailyTimePicker(
    times: List<Long>,
    minutes: Int?,
    label: String,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    suggested: Int? = null,
    stale: Boolean = false,
) {
    if (minutes == null) {
        Box(
            modifier
                .size(width = 160.dp, height = 48.dp)
                .background(MaterialTheme.colorScheme.surfaceContainerHighest, MaterialTheme.shapes.small),
        )
        return
    }

    var open by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()
    val shown = formatMinutes(minutes, locale)

    Box(modifier) {
        Row(
            modifier =
                Modifier
                    .clip(MaterialTheme.shapes.small)
                    // Disabled, it stays focusable, as main's is: focus waits on it while a time saves.
                    .clickable(role = Role.DropdownList) { if (enabled) open = true }
                    .semantics(mergeDescendants = true) {
                        contentDescription = "$label, $shown"
                        if (!enabled) disabled()
                    }.alpha(if (stale || !enabled) STALE_ALPHA else 1f)
                    .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(shown, style = MaterialTheme.typography.displaySmall.withTabularFigures())
            Icon(painterResource(R.drawable.ic_expand_more), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TimeMenu(
            expanded = open,
            onDismissRequest = { open = false },
            times = pickerTimes(times, minutes, suggested),
            shown = minutes,
            onPick = onChange,
            label = { time ->
                if (time == suggested) {
                    stringResource(R.string.onboarding_schedule_suggested, formatMinutes(time, locale))
                } else {
                    formatMinutes(time, locale)
                }
            },
        )
    }
}

/** Main's time select: the time a day [label] names, picked from every daily time. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeSelect(
    label: String,
    times: List<Long>,
    value: Int?,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        OutlinedTextField(
            value = value?.let { formatMinutes(it, locale) }.orEmpty(),
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            singleLine = true,
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            pickerTimes(times, value).forEach { minutes ->
                DropdownMenuItem(
                    text = { Text(formatMinutes(minutes, locale)) },
                    onClick = {
                        expanded = false
                        onPick(minutes)
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
}

private val MENU_ITEM_HEIGHT = 48.dp

private const val STALE_ALPHA = 0.6f
