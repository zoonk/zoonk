package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.clearAndSetSemantics

/**
 * Main's `SwapLabel`: a label that changes with its control's state ("Flag", "Remove flag")
 * without changing the control's width. Every label takes the same cell and only the shown one
 * is drawn and read.
 */
@Composable
fun SwapLabel(
    labels: List<String>,
    shown: Int,
    modifier: Modifier = Modifier,
) {
    Box(modifier, contentAlignment = Alignment.Center) {
        labels.forEachIndexed { index, label ->
            if (index == shown) {
                Text(label)
            } else {
                Text(label, Modifier.alpha(0f).clearAndSetSemantics {})
            }
        }
    }
}
