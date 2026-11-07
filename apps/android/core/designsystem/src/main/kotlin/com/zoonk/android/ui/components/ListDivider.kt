package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/** Main's hairline between a list's rows (`divided-rows`), on the words' margin rather than the screen's edges. */
@Composable
fun ListDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier.padding(horizontal = LIST_ITEM_INSET))
}
