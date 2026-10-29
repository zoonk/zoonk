package com.zoonk.android.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's `Steps`: a few steps one at a time, with back (a button and the system's back) and next,
 * and the last step's own action in place of next. Back from the first step leaves as the screen does.
 */
@Composable
fun StepPagerActions(
    count: Int,
    index: Int,
    onIndexChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    finalAction: @Composable () -> Unit,
) {
    BackHandler(enabled = index > 0) { onIndexChange(index - 1) }

    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (index > 0) {
            OutlinedIconButton(onClick = { onIndexChange(index - 1) }) {
                Icon(painterResource(R.drawable.ic_arrow_back), contentDescription = stringResource(R.string.navigation_back))
            }
        }

        StepDots(count, index, Modifier.weight(1f))

        if (index < count - 1) {
            Button(onClick = { onIndexChange(index + 1) }) { Text(stringResource(R.string.steps_continue)) }
        } else {
            finalAction()
        }
    }
}

/** Decorative: each step's own heading says where the learner is. */
@Composable
private fun StepDots(
    count: Int,
    index: Int,
    modifier: Modifier,
) {
    if (count < 2) {
        Row(modifier) {}
        return
    }

    val current = MaterialTheme.colorScheme.onSurface
    val other = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)

    Row(modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        repeat(count) { step ->
            Canvas(Modifier.size(6.dp)) { drawCircle(if (step == index) current else other) }
        }
    }
}
