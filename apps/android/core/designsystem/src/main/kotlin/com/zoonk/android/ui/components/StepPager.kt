package com.zoonk.android.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's `Steps`: a few steps one at a time, with back (a button and the system's back) and Continue,
 * and the last step's own action in place of Continue, each the bar's main action. The screen shows
 * [StepDots] in its top bar. Back from the first step leaves as the screen does.
 */
@Composable
fun StepPagerActions(
    count: Int,
    index: Int,
    onIndexChange: (Int) -> Unit,
    finalAction: @Composable FlowRowScope.(main: Modifier) -> Unit,
) {
    BackHandler(enabled = index > 0) { onIndexChange(index - 1) }

    // Back stays outside the actions' row, level with its last line when they wrap at a large font.
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
        if (index > 0) {
            OutlinedIconButton(onClick = { onIndexChange(index - 1) }) {
                Icon(painterResource(R.drawable.ic_arrow_back), contentDescription = stringResource(R.string.navigation_back))
            }
        }
        Box(Modifier.weight(1f)) {
            TaskActions { main ->
                if (index < count - 1) {
                    Button(onClick = { onIndexChange(index + 1) }, modifier = main) { Text(stringResource(R.string.steps_continue)) }
                } else {
                    finalAction(main)
                }
            }
        }
    }
}

@Composable
fun StepDots(
    count: Int,
    index: Int,
    modifier: Modifier = Modifier,
) {
    if (count < 2) {
        Row(modifier) {}
        return
    }

    val current = MaterialTheme.colorScheme.onSurface
    val other = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)

    val description = stringResource(R.string.steps_progress, index + 1, count)

    Row(
        modifier.clearAndSetSemantics {
            contentDescription = description
        },
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        repeat(count) { step ->
            Canvas(Modifier.size(6.dp)) { drawCircle(if (step == index) current else other) }
        }
    }
}
