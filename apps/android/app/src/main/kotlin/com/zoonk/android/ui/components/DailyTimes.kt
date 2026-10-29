package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes

/** The time chips, with the learner's own times among them, so a time picked in [OtherTime] joins the chips. */
fun timeChoices(vararg times: Int?): List<Int> = (MINUTE_OPTIONS + times.filterNotNull()).distinct().sorted()

/** Every daily time a menu offers, with the ones shown among them. */
fun otherTimes(vararg shown: Int?): List<Int> = (DAILY_TIMES + shown.filterNotNull()).distinct().sorted()

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

/** Main's other-time menu under the time chips; [label] says what the time is for. */
@Composable
fun OtherTime(
    shown: Int,
    label: String,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by rememberSaveable { mutableStateOf(false) }

    Box(modifier) {
        TextButton(onClick = { open = true }, modifier = Modifier.semantics { contentDescription = label }) {
            Text(stringResource(R.string.other_time))
        }
        TimeMenu(open, { open = false }, otherTimes(shown), shown, onPick)
    }
}

/** Main's time select: the time a day [label] names, picked from every daily time. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeSelect(
    label: String,
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
            otherTimes(value).forEach { minutes ->
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

private val MINUTE_OPTIONS = listOf(15, 30, 45, 60, 90, 120, 180, 240)

private const val MAX_DAILY_MINUTES = 1440

private val DAILY_TIMES = (15..240 step 15) + (270..MAX_DAILY_MINUTES step 30)

private val MENU_ITEM_HEIGHT = 48.dp
