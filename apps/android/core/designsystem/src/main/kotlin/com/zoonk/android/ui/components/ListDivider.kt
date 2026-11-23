package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/**
 * Main's hairline between a list's rows (`divided-rows`), on the words' margin rather than the screen's edges. Touching a
 * highlighted row ([besideHighlight]) it turns transparent rather than going, so nothing moves when the highlight does.
 */
@Composable
fun ListDivider(
    modifier: Modifier = Modifier,
    besideHighlight: Boolean = false,
) {
    HorizontalDivider(
        modifier.padding(horizontal = LIST_ITEM_INSET),
        color = if (besideHighlight) Color.Transparent else DividerDefaults.color,
    )
}
