package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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

/** Every time [OtherTime] offers, with the one shown among them. */
fun otherTimes(shown: Int?): List<Int> = if (shown == null || shown in DAILY_TIMES) DAILY_TIMES else (DAILY_TIMES + shown).sorted()

/** Main's other-time menu under the time chips; [label] says what the time is for. */
@Composable
fun OtherTime(
    shown: Int,
    label: String,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()
    val times = otherTimes(shown)
    val itemHeight = with(LocalDensity.current) { MENU_ITEM_HEIGHT.roundToPx() }
    val scroll = remember(open, shown) { ScrollState(times.indexOf(shown).coerceAtLeast(0) * itemHeight) }

    Box(modifier) {
        TextButton(onClick = { open = true }, modifier = Modifier.semantics { contentDescription = label }) {
            Text(stringResource(R.string.other_time))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, scrollState = scroll) {
            times.forEach { time ->
                DropdownMenuItem(
                    text = { Text(formatMinutes(time, locale)) },
                    onClick = {
                        open = false
                        onPick(time)
                    },
                )
            }
        }
    }
}

private val MINUTE_OPTIONS = listOf(15, 30, 45, 60, 90, 120, 180, 240)

private const val MAX_DAILY_MINUTES = 1440

private val DAILY_TIMES = (15..240 step 15) + (270..MAX_DAILY_MINUTES step 30)

private val MENU_ITEM_HEIGHT = 48.dp
