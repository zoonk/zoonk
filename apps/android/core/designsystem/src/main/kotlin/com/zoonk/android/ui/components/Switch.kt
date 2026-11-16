package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Material's switch. Material draws an off switch's thumb in `outline`, which is Zoonk's pale field border, so off
 * read fainter than disabled: off, the thumb takes the quiet ink, and a disabled one Material's 38% of it.
 */
@Composable
fun Switch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val thumb = MaterialTheme.colorScheme.onSurfaceVariant
    androidx.compose.material3.Switch(
        checked = checked,
        onCheckedChange = onCheckedChange,
        modifier = modifier,
        enabled = enabled,
        colors =
            SwitchDefaults.colors(
                uncheckedThumbColor = thumb,
                disabledUncheckedThumbColor = thumb.copy(alpha = DISABLED_THUMB),
            ),
    )
}

private const val DISABLED_THUMB = 0.38f
