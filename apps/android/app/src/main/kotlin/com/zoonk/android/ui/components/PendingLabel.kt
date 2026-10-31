package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** A button's label with a spinner before it while its work runs, as main's `PendingLabel`. */
@Composable
fun RowScope.PendingLabel(
    pending: Boolean,
    text: String,
) {
    if (pending) {
        CircularProgressIndicator(modifier = Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
    }
    Text(text)
}
